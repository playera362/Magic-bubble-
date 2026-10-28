#!/bin/sh

##############################################################################
# Gradle start up script for POSIX generated for Gradle 9.1.0
##############################################################################

set -e

APP_HOME=$( cd "${0%/*}" && pwd -P ) || exit
CLASSPATH="$APP_HOME/gradle/wrapper/gradle-wrapper.jar"

# Self-heal gradle-wrapper.jar if absent in fresh git checkouts
if [ ! -f "$CLASSPATH" ]; then
    mkdir -p "$APP_HOME/gradle/wrapper"
    curl -fsSL "https://raw.githubusercontent.com/gradle/gradle/v9.1.0/gradle/wrapper/gradle-wrapper.jar" -o "$CLASSPATH" \
      || curl -fsSL "https://raw.githubusercontent.com/gradle/gradle/v8.12.0/gradle/wrapper/gradle-wrapper.jar" -o "$CLASSPATH"
fi

if [ -n "$JAVA_HOME" ] ; then
    if [ -x "$JAVA_HOME/jre/sh/java" ] ; then
        JAVACMD="$JAVA_HOME/jre/sh/java"
    else
        JAVACMD="$JAVA_HOME/bin/java"
    fi
    if [ ! -x "$JAVACMD" ] ; then
        echo "ERROR: JAVA_HOME is set to an invalid directory: $JAVA_HOME" >&2
        exit 1
    fi
else
    JAVACMD=java
    if ! command -v java >/dev/null 2>&1 ; then
        echo "ERROR: JAVA_HOME is not set and no 'java' command could be found in your PATH." >&2
        exit 1
    fi
fi

DEFAULT_JVM_OPTS='"-Xmx64m" "-Xms64m"'

exec "$JAVACMD" \
  -Xmx64m -Xms64m \
  -Dorg.gradle.appname="gradlew" \
  -classpath "$CLASSPATH" \
  org.gradle.wrapper.GradleWrapperMain \
  "$@"
