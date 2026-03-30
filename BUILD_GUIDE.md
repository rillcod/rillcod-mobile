# Rillcod Academy Mobile — Build & Development Guide 🚀

This guide documents the procedures for compiling and running the **Rillcod Academy Expo application**, especially since the project has graduated from standard Expo Go and now requires a **Custom Development Build**.

---

## 1. Why Can’t We Use Standard "Expo Go" Anymore?
The app now uses **Turbo Modules** (the New React Native Architecture) and custom native modules (like `@supabase`, `expo-dev-client`, camera access, etc.). 
Because of this, scanning a standard QR code with the Expo Go app downloaded from the App/Play Store will crash immediately. The app must be compiled locally or via EAS to create a dedicated `.apk` / `.app` that understands your custom C++ code.

---

## 2. Option A: Building Locally on your Machine
If you want to build the app using your own computer's CPU, run this command once:
```bash
npx expo run:android
```
- **How it works:** It translates all the JavaScript and C++ into a native `.apk` file and installs it directly on your open emulator.
- **Speed:** The first time it runs, it can take **45–60 minutes** to compile the C++ architecture from pure scratch. Every run after that is permanently cached and takes less than a minute.

### ⚠️ Local Build Troubleshooting: The `JAVA_HOME` Error
If `npx expo run:android` crashes instantly with an invalid directory error, it means the Windows environment variables are incorrect.
1. Press your Windows key and search **"Environment Variables"**.
2. Find `JAVA_HOME`.
3. Ensure it is exactly: `C:\Program Files\Android\Android Studio\jbr` (Make sure it does NOT end in `\jbr\jbr`!).
4. Close the VS Code terminal completely, open a new one, and try again.

---

## 3. Option B: Building in the Cloud (EAS Build)
If you do not want to use your computer’s CPU (or wait an hour for local builds), you can have Expo’s high-speed servers build it for you.
```bash
eas build -p android --profile development
```
- **How it works:** It zips your code, sends it to Expo's servers, builds the `.apk`, and provides you with an installation link/QR code.
- **Physical Phone Installation:** Scan the QR code generated in the terminal with your physical phone's **Camera App** to download and install the app natively on your device.

### ⚠️ EAS Build Troubleshooting: The "Signature Mismatch" Error
If EAS tries to automatically install the app onto your computer's emulator and fails with an `INSTALL_FAILED_UPDATE_INCOMPATIBLE` error:
- **Why?** You already have an older copy of the app on your emulator that was signed with a local Debug Key. The EAS cloud uses a remote Expo key. The two security keys are incompatible, so Android blocks the update.
- **Fix:** Long-press the app icon on the emulator, choose **Uninstall**, then run `eas build:run -p android` (or drag the downloaded `.apk` back onto the emulator window).

---

## 4. The "Invalid Hook Call" Error (React Mismatch)
If your app successfully bundles but immediately shows a red screen upon opening with `Invalid hook call` and `TypeError: Cannot read property 'useContext' of null`:
- **Why?** A third-party library in your `node_modules` (in our case, `moti`) sneakily installed a duplicate version of `react` inside its own folder, confusing everything.
- **Fix:** Navigate into the offending module (e.g., `node_modules/moti/node_modules`) and delete the duplicate `react` folder, and ensure `package.json` locks the React version to `19.2.4` across the board.
- **CRITICAL STEP:** After modifying `node_modules`, you must tell the Metro bundler to wipe its internal memory cache or it will keep loading the crash:
```bash
npx expo start -c
```
