To build the APK from the command line:

# 0. Get gradle-wrapper.jar (not needed when Gradle or Android Studio is installed)
wget -O gradle/wrapper/gradle-wrapper.jar \
  https://raw.githubusercontent.com/gradle/gradle/v8.6.0/gradle/wrapper/gradle-wrapper.jar
# verify checksum (from https://gradle.org/release-checksums/ → wrapper jar SHA-256 for 8.6)
sha256sum gradle/wrapper/gradle-wrapper.jar
# expected: d3b261c2820e9e3d8d639ed084900f11f4a86050a8f83342ade7b6bc9b0d2bdd

# 1. Install prerequisites (JDK already on this machine)
sudo apt install openjdk-21-jdk   # already installed

# 2. Get Android SDK command-line tools + accept licenses
mkdir -p ~/android-sdk/cmdline-tools
cd ~/android-sdk/cmdline-tools
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip commandlinetools-linux-*_latest.zip && mv cmdline-tools latest

export ANDROID_HOME=$HOME/android-sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools
sdkmanager --licenses
sdkmanager "platforms;android-35" "build-tools;35.0.0" "platform-tools"

# 3. Build
cd apk/
./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk

# 4. Install
adb install app/build/outputs/apk/debug/app-debug.apk
