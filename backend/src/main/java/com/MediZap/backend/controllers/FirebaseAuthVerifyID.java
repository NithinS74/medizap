package com.MediZap.backend.controllers;

import com.MediZap.backend.security.FirebaseAuthenticationService;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class FirebaseAuthVerifyID {

    private FirebaseAuthenticationService fauth;

    @PostMapping("/verify")
    public ResponseEntity<?> verifyToken(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, Object> payload) {
        try {
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Missing or invalid Authorization header"));
            }
            String idToken = authHeader.substring(7); // Remove "Bearer " prefix
            FirebaseToken decodedToken = fauth.verifyToken(idToken);
            String uid = decodedToken.getUid();
            String email = decodedToken.getEmail();
            logger.info("\n---->>>>>>>>>LOGIN REDIVED<<<<<<<<----\n" + uid + "\n" + email + "\n");

            return ResponseEntity.ok(Map.of(
                    "status", "success",
                    "uid", uid,
                    "email", email,
                    "payload_uid", payload.get("uid") // optional, sent from frontend
            ));

        } catch (FirebaseAuthException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid ID token", "message", e.getMessage()));
        }
    }
}
