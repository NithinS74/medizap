package com.MediZap.backend.security;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import org.springframework.stereotype.Service;

@Service
public class FirebaseAuthenticationService {
    private FirebaseToken token;

    public FirebaseToken verifyToken(String idToken) throws FirebaseAuthException {
        if (idToken == null || idToken.trim().isEmpty()) {
            throw new IllegalArgumentException("ID token must not be null or empty");
        }

        this.token = FirebaseAuth.getInstance().verifyIdToken(idToken);
        return this.token;
    }

    public String getUidFromToken() throws FirebaseAuthException {
        return this.token.getUid();
    }

    public String getEmailFromToken() throws FirebaseAuthException {
        return this.token.getEmail();
    }
}
