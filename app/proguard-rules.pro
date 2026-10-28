# ProGuard / R8 rules for Magic Bubble Pop (com.playera.magicbubblepop)
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-dontwarn androidx.webkit.**
