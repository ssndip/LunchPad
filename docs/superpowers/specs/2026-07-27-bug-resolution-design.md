# Bug Resolution Design Document

## Goal
Resolve three identified performance and input validation bugs across the codebase.

1. **N+1 DB Queries in `fetchMenuBackups`**: Optimize item count retrieval inside a single database query using SQLite's native `json_array_length(menuData)`.
2. **N+1 DB Queries in `exportAllProfiles`**: Optimize latest version retrieval inside a single database query using a LEFT JOIN subquery.
3. **Missing `ownerName` validation in `updateSingleCard`**: Prevent SQLite NOT NULL constraint failures by returning a proper 400 validation error if `ownerName` is invalid or missing.

## 1. N+1 DB Queries in `fetchMenuBackups`

### Existing Code
```typescript
const backups = db.prepare("SELECT id, timestamp, menuDate, menuVersion, length(menuData) as rawSize FROM menu_backups ORDER BY timestamp DESC").all() as any[];
res.json(backups.map(b => {
  let itemCount = 0;
  try {
    const fullBackup = db.prepare("SELECT menuData FROM menu_backups WHERE id = ?").get(b.id) as { menuData: string } | undefined;
    if (fullBackup) {
      const parsed = JSON.parse(fullBackup.menuData);
      itemCount = Array.isArray(parsed) ? parsed.length : 0;
    }
  } catch (e) {}
  return { id: b.id, timestamp: b.timestamp, menuDate: b.menuDate, menuVersion: b.menuVersion, itemCount };
}));
```

### Proposed Design
```typescript
const backups = db.prepare(`
  SELECT id, timestamp, menuDate, menuVersion, json_array_length(menuData) as itemCount 
  FROM menu_backups 
  ORDER BY timestamp DESC
`).all() as any[];
res.json(backups);
```

---

## 2. N+1 DB Queries in `exportAllProfiles`

### Existing Code
```typescript
const profiles = db.prepare("SELECT * FROM parser_profiles").all() as ParserProfile[];
const bundle = {
  version: "1.0",
  type: "LUNCHPAD_PARSER_BUNDLE",
  exportedAt: new Date().toISOString(),
  profiles: profiles.map(p => {
    const latestVersion = db.prepare("SELECT * FROM parser_versions WHERE profileId = ? ORDER BY versionNumber DESC LIMIT 1").get(p.id) as ParserVersion;
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      isActive: p.isActive,
      config: JSON.parse(latestVersion.configJson)
    };
  })
};
```

### Proposed Design
```typescript
const profilesWithConfig = db.prepare(`
  SELECT 
    p.id, 
    p.name, 
    p.description, 
    p.isActive, 
    v.configJson
  FROM parser_profiles p
  LEFT JOIN parser_versions v ON v.profileId = p.id
    AND v.versionNumber = (
      SELECT MAX(versionNumber) 
      FROM parser_versions 
      WHERE profileId = p.id
    )
`).all() as any[];

const bundle = {
  version: "1.0",
  type: "LUNCHPAD_PARSER_BUNDLE",
  exportedAt: new Date().toISOString(),
  profiles: profilesWithConfig.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    isActive: p.isActive,
    config: p.configJson ? JSON.parse(p.configJson) : {}
  }))
};
```

---

## 3. Missing `ownerName` Validation in `updateSingleCard`

### Existing Code
```typescript
export const updateSingleCard = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rfid } = req.params;
    const { ownerName, balance, isAdmin, pin } = req.body;
    const cleanRfid = cleanRfidUtil(rfid);

    const numBalance = balance !== undefined && balance !== null ? Number(balance) : 0;
    // ...
```

### Proposed Design
```typescript
export const updateSingleCard = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rfid } = req.params;
    const { ownerName, balance, isAdmin, pin } = req.body;
    const cleanRfid = cleanRfidUtil(rfid);

    if (!ownerName || typeof ownerName !== 'string' || ownerName.length > 100) {
      return res.status(400).json({ error: "Invalid or missing ownerName" });
    }

    const numBalance = balance !== undefined && balance !== null ? Number(balance) : 0;
    // ...
```
