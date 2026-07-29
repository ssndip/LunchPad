# 🏷️ Web NFC Sticker Identification Design Spec

This document details the design for adding user identification using programmable NFC stickers side-by-side with the existing RFID cards. By leveraging the modern Web NFC API (`NDEFReader`), secure tablets can read and write NFC tags natively in the browser, eliminating the need for external RFID USB hardware.

---

## 1. Feature Requirements & UX Flow

### 1.1. Kiosk Scanning (Reading NFC)
* **Auto-Start**: The Web NFC scanner starts reading automatically on the Kiosk page when the user first interacts (clicks/taps) anywhere on the screen.
* **Header Status Button**: A small NFC signal icon is shown in the top header.
  * *Green (pulsing)*: NFC active and scanning.
  * *Gray/Hidden*: NFC unsupported or disabled.
  * *Red (warning)*: Permission blocked or hardware error. Hovering/tapping shows the error message.
  * *Action*: Clicking this button manually re-initializes the NFC scan (e.g. to re-trigger a blocked permission prompt).
* **Identification Pipeline**: Tapping an NFC tag triggers the same check-out or pre-identification sequence as a traditional physical card swipe.

### 1.2. Admin Tag Programming (Writing NFC)
* **Write Button**: Next to each card in the Admin dashboard card table, a **"Write NFC"** action is available.
* **Programming Modal**: Opens a modal prompting: *"Place NFC sticker against device to program"*. The system writes the card's ID/RFID string as a standard NDEF Text Record.
* **Registration Scan**: In the Add/Edit Card Modal, clicking the NFC icon inside the **RFID** input field starts an NFC scan that automatically fills the input field with the scanned tag's ID or UID.

---

## 2. Technical Architecture & APIs

### 2.1. NFC Identification Strategy (Hybrid Match)
Web NFC's reading callback returns an `NDEFReadingEvent` containing NDEF records and a hardware `serialNumber` (UID). The reader will parse the tag as follows:
1. **NDEF Text Record**: Attempt to decode the first text record using `TextDecoder`. If present, this text (e.g. `"1234567890"`) is used as the card ID.
2. **UID Fallback**: If no text record is found (e.g., a blank tag), fall back to the tag's raw `serialNumber`. Colons are stripped and the string is low-cased (e.g. `04:12:ab:cd` -> `0412abcd`) to match SQLite primary key requirements.

### 2.2. New Hook: `useNfcScanner.ts`
This hook encapsulates Web NFC reader interaction:
* **Properties**:
  * `onScan: (id: string) => void`
  * `active: boolean`
* **Lifecycle**:
  * On mount/first interaction, checks `typeof NDEFReader !== 'undefined'`.
  * Instantiates `new NDEFReader()` and calls `.scan()`.
  * Handles `onreading` events, extracts the card ID/UID, and calls `onScan`.

### 2.3. New Hook: `useNfcWriter.ts`
This hook encapsulates Web NFC writing:
* **Properties**:
  * `writeId: (id: string) => Promise<void>`
  * `writeStatus: 'idle' | 'waiting' | 'writing' | 'success' | 'error'`
  * `errorMessage: string | null`
* **Write Logic**:
  ```typescript
  const ndef = new NDEFReader();
  await ndef.write({
    records: [{ recordType: "text", data: id }]
  });
  ```

---

## 3. UI Modifications & Components

### 3.1. Kiosk Interface Updates
* **[KioskView.tsx](file:///home/ssndip/lunchpadgit/src/components/kiosk/KioskView.tsx)**:
  * Integrate `useNfcScanner` side-by-side with `useRfidScanner`.
  * Add the status indicator next to the network/language status options in the header.

### 3.2. Admin Dashboard Updates
* **[CardsTab.tsx](file:///home/ssndip/lunchpadgit/src/components/manager/tabs/CardsTab.tsx)**:
  * Render a "Write to NFC" button in each card row.
  * Integrate the `NfcWriteModal` with a pulsing animation showing tag writing state.
  * Add the NFC Scan trigger button inside the Add/Edit card forms for the RFID field.

---

## 4. Security & Secure Context Constraints
* Web NFC is strictly gated by the browser to **Secure Contexts (HTTPS / Localhost)**.
* The UI elements will detect and degrade gracefully on unsupported contexts (e.g. hiding the NFC buttons or showing a helper notification explaining why NFC is disabled).

---

## 5. Testing & Verification Plan

### 5.1. Unit Tests
* **`useNfcScanner.test.ts`**: Mock `NDEFReader` to simulate successful NDEF text record reading, blank tag serial number reading, and permission error handling.
* **`useNfcWriter.test.ts`**: Mock `NDEFReader.write` to verify the payload is structured correctly as an NDEF text record.

### 5.2. Manual Integration Check
* Deploy the updated container behind the HTTPS proxy (`https://ss.plcnet.org:3402`).
* Validate NFC reading on an Android tablet in Chrome.
* Validate NFC writing from the Cards management panel.
