plugins {
    alias(libs.plugins.android.application)
}

android {
    namespace = "com.playera.magicbubblepop"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.playera.magicbubblepop"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1"
    }

    signingConfigs {
        getByName("debug") {
            val localDebugKeystore = rootProject.file("debug.keystore")
            if (localDebugKeystore.exists()) {
                storeFile = localDebugKeystore
                storePassword = "android"
                keyAlias = "androiddebugkey"
                keyPassword = "android"
            }
        }
        create("release") {
            val envKeystorePath = System.getenv("KEYSTORE_PATH")
            if (!envKeystorePath.isNullOrBlank() && file(envKeystorePath).exists()) {
                storeFile = file(envKeystorePath)
                storePassword = System.getenv("KEYSTORE_PASSWORD") ?: "android"
                keyAlias = System.getenv("KEY_ALIAS") ?: "androiddebugkey"
                keyPassword = System.getenv("KEY_PASSWORD") ?: "android"
            } else {
                storeFile = rootProject.file("debug.keystore")
                storePassword = "android"
                keyAlias = "androiddebugkey"
                keyPassword = "android"
            }
        }
    }

    buildTypes {
        getByName("debug") {
            signingConfig = signingConfigs.getByName("debug")
        }
        getByName("release") {
            isMinifyEnabled = true
            isShrinkResources = true
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.webkit)
}
