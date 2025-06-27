FROM eclipse-temurin:24-jdk AS builder

# Install Maven
RUN apt-get update && \
    apt-get install -y maven && \
    apt-get clean

WORKDIR /app
COPY . .

CMD ["mvn", "spring-boot:run"]
