/**
 * AFRICA OF HOPE — OneSignal Android SDK template for the APK build lane.
 *
 * Follows https://raw.githubusercontent.com/OneSignal/sdk-ai-prompts/main/docs/android/ai-prompt.md
 * (OneSignal Android SDK v5, Gradle plugin + Application.onCreate init).
 *
 * This web repo has NO android/ folder (web-only PWA), so these snippets are
 * applied in the EXTERNAL Android/Capacitor project used to build the APK —
 * never in the web bundle. No package name, fingerprint, or key is invented
 * here: replace every PLACEHOLDER with the real production value.
 *
 * Covered by the ai-prompt flow:
 *  1. Gradle plugin + dependency (v5)          -> GRADLE_* templates below
 *  2. Application subclass init                -> APPLICATION_KT template
 *  3. Manifest permissions + deep-link intent  -> MANIFEST_XML template
 *  4. FCM via google-services.json (NOT committed) + OneSignal dashboard FCM
 *  5. Notification channel (aoh_school)        -> CHANNEL_KT template
 *  6. Notification-opened -> ?push_view= deep link (already handled by
 *     src/lib/androidPush.ts handlePushColdStart + App.tsx resume)
 */

/** Same OneSignal app as web (public ID only — safe). REST key stays server-side. */
export const ONESIGNAL_APP_ID = "1c7444cf-8299-48c3-adf7-0d1b32dbed7b";

/** Notification channel used by time-sensitive school alerts. */
export const AOH_CHANNEL_ID = "aoh_school";

export const GRADLE_SETTINGS = `// settings.gradle (Android/Capacitor project)
// OneSignal Gradle plugin (see ai-prompt: plugins block, version 5.x)
plugins {
    id "com.onesignal.androidsdk.onesignal-gradle-plugin" version "5.2.6" apply false
    id "com.google.gms.google-services" version "4.4.2" apply false
}`;

export const GRADLE_APP = `// android/app/build.gradle
plugins {
    id "com.android.application"
    id "com.onesignal.androidsdk.onesignal-gradle-plugin"
    id "com.google.gms.google-services" // FCM: needs google-services.json (NOT in git)
}
dependencies {
    // OneSignal Android SDK v5 (ai-prompt: current 5.x line)
    implementation "com.onesignal:OneSignal:5.2.6"
    // Capacitor compatibility is via the web-view + onesignal-cordova-plugin
    // bridge (src/lib/nativeOneSignal.ts); do NOT also add the web SDK here.
}`;

export const APPLICATION_KT = `// MainApplication.kt (ai-prompt: init in Application.onCreate)
import android.app.Application
import com.onesignal.OneSignal
import com.onesignal.debug.LogLevel

class MainApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        OneSignal.setLogLevel(LogLevel.NONE, LogLevel.NONE)
        // App ID only — never embed the REST API key in the APK.
        OneSignal.initWithContext(this, "${ONESIGNAL_APP_ID}")
        // Android 13+: runtime opt-in from a user gesture (panel button).
        OneSignal.getNotifications().requestPermission(true)
        // Notification taps carry additionalData.target_url = "/?push_view=<view>".
        // The WebView loads that URL; handlePushColdStart() + login resume
        // (src/lib/androidPush.ts, src/App.tsx) route to the right screen.
        OneSignal.getNotifications().addClickListener { event ->
            val url = event.notification.additionalData?.optString("target_url")
                ?: "/?push_view=dashboard"
            // Load url in the WebView (Capacitor: Bridge / TWA: Custom Tab).
        }
        // Identity: after Supabase sign-in, web bridge calls
        // OneSignal.login(<supabase_user_id>) + addTags(platform=android-wrapper).
        // On sign-out call OneSignal.logout() — never another student's ID.
    }
}`;

export const MANIFEST_XML = `<!-- AndroidManifest.xml (ai-prompt: permissions + launcher intent) -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- FCM delivery + Android 13 runtime permission -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="com.google.android.c2dm.permission.RECEIVE" />
    <application android:name=".MainApplication" ...>
        <activity android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTask">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
            <!-- Deep link for push taps + App Links (fill assetlinks.json) -->
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <!-- Replace with the REAL production origin -->
                <data android:scheme="https" android:host="YOUR-PRODUCTION-HOST" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;

export const CHANNEL_KT = `// Notification channel (create once in MainActivity/Application)
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

fun createSchoolChannel(ctx: android.content.Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val mgr = ctx.getSystemService(NotificationManager::class.java)
    // Idempotent: safe to call on every launch.
    mgr.createNotificationChannel(NotificationChannel(
        "${AOH_CHANNEL_ID}", "School alerts",
        NotificationManager.IMPORTANCE_HIGH
    ).apply {
        description = "Class, exam, material, fee, certificate and announcement alerts"
        enableVibration(true)
        enableLights(true)
        // PUBLIC = banner content visible on the lock screen.
        lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
    })
}`;

export const CAPACITOR_CONFIG = `// capacitor.config.ts (APK build lane — replace placeholders)
import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "YOUR.REAL.PACKAGE.NAME", // NEVER invent: exact name registered in Firebase
  appName: "Africa of Hope",
  webDir: "dist",
  server: { url: "https://YOUR-PRODUCTION-HOST", cleartext: false },
  plugins: { PushNotifications: { presentationOptions: ["badge", "sound", "alert"] } },
};
export default config;`;

/** Owner build-lane checklist (mirrors supabase/ANDROID_APK_PUSH_SETUP.md). */
export const BUILD_LANE_STEPS: string[] = [
  "Create/reuse the school Firebase project; register the EXACT package name.",
  "Download google-services.json into android/app/ (never commit it).",
  "Apply GRADLE_SETTINGS + GRADLE_APP + APPLICATION_KT + MANIFEST_XML + CHANNEL_KT above.",
  "OneSignal dashboard: same app -> Google Android (FCM) platform with the FCM credential.",
  "Build a signed release APK (signing key stays with the owner, never in git).",
  "Install on a physical phone; accept notification permission; confirm the Android subscription under the right external_id.",
  "Lock the phone with the app closed; send a test; confirm the lock-screen banner; tap -> correct portal view.",
];
