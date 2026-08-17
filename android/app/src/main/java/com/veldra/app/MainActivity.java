package com.veldra.app;

import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Must be called before super.onCreate() per the AndroidX SplashScreen contract --
        // this is what actually applies AppTheme.NoActionBarLaunch's windowSplashScreenBackground/
        // windowSplashScreenAnimatedIcon/postSplashScreenTheme (styles.xml) instead of them sitting
        // unused. Without this call the dependency (app/build.gradle) was dead weight and the
        // theme's splash attributes were never read by anything.
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
    }
}
