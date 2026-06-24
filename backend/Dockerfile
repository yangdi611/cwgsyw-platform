FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN apk add --no-cache maven && mvn package -Dmaven.test.skip=true

FROM eclipse-temurin:21-jre-alpine
# postgresql16-client → pg_dump/psql for backup/restore; tar for archiving
RUN apk add --no-cache font-noto-cjk pandoc postgresql16-client tar
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
