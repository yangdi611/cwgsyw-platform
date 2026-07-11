FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
RUN apk add --no-cache maven

COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2/repository \
    --mount=type=secret,id=maven_settings,target=/tmp/settings.xml,required=false \
    if [ -f /tmp/settings.xml ]; then \
      mvn -s /tmp/settings.xml dependency:go-offline; \
    else \
      mvn dependency:go-offline; \
    fi

COPY src ./src
RUN --mount=type=cache,target=/root/.m2/repository \
    --mount=type=secret,id=maven_settings,target=/tmp/settings.xml,required=false \
    if [ -f /tmp/settings.xml ]; then \
      mvn -s /tmp/settings.xml package -Dmaven.test.skip=true; \
    else \
      mvn package -Dmaven.test.skip=true; \
    fi

FROM eclipse-temurin:21-jre-alpine
# postgresql16-client → pg_dump/psql for backup/restore; tar for archiving
RUN apk add --no-cache font-noto-cjk pandoc postgresql16-client tar
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
