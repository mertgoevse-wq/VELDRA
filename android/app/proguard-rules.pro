# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# minifyEnabled was turned on for release builds without any VELDRA-specific rules added
# here, because Capacitor's own AAR ships real consumer ProGuard rules (verified at
# node_modules/@capacitor/android/capacitor/proguard-rules.pro) covering @CapacitorPlugin
# classes, Plugin subclasses (covers @capacitor/app, @capacitor/filesystem, @capacitor/share),
# and Cordova plugin classes -- AGP merges those in automatically, no manual -keep needed for
# them. This project has no custom native (Java/Kotlin) code beyond a bare MainActivity, so
# there is nothing else here that reflection/JS-bridge stripping could break. If custom
# native plugins or JavaScript-interface classes are added later, they need their own -keep
# rules added here before shipping a release build.
