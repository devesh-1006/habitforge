package com.habitforge.user;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {
    public record ProfileResponse(UUID id, String name, String email) {}

    @GetMapping
    public ProfileResponse profile(@AuthenticationPrincipal AppUser user) {
        return new ProfileResponse(user.getId(), user.getName(), user.getEmail());
    }
}
