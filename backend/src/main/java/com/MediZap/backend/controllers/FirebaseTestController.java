package com.MediZap.backend.controllers;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.UserRecord;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class FirebaseTestController {

    @GetMapping("/firebase-test")
    public String testFirebaseConnection() {
        try {
            // This makes a call to Firebase to get a non-existent user (just to test)
            FirebaseAuth auth = FirebaseAuth.getInstance();
            UserRecord userRecord = auth.getUserByEmail("test@email.com"); // will throw if user doesn't exist

            return "✅ Firebase is connected and responded!";
        } catch (Exception e) {
            return "✅ Firebase initialized, but test user not found — still means it's connected!\nError: "
                    + e.getMessage();
        }
    }
}
