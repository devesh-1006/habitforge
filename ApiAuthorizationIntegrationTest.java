package com.habitforge;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.habitforge.habit.HabitCompletionRepository;
import com.habitforge.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;
import java.time.LocalDate;
import java.time.ZoneId;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ApiAuthorizationIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired HabitCompletionRepository completions;

    @Test
    void usersCanAuthenticateButCannotReadOrChangeAnotherUsersRecords() throws Exception {
        String suffix = UUID.randomUUID().toString();
        String emailA = "owner-" + suffix + "@example.com";
        String emailB = "other-" + suffix + "@example.com";
        String tokenA = register(emailA, "Owner");
        String tokenB = register(emailB, "Other");

        var account = users.findByEmailIgnoreCase(emailA).orElseThrow();
        assertTrue(passwordEncoder.matches("correct-horse-battery", account.getPasswordHash()));
        assertNotEquals("correct-horse-battery", account.getPasswordHash());

        mvc.perform(get("/api/profile").header("Authorization", bearer(tokenA)))
                .andExpect(status().isOk());
        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(java.util.Map.of(
                                "name", "Different Case", "email", emailA.toUpperCase(), "password", "correct-horse-battery"))))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(java.util.Map.of(
                                "email", emailA.toUpperCase(), "password", "correct-horse-battery"))))
                .andExpect(status().isOk());
        mvc.perform(get("/api/habits"))
                .andExpect(status().isUnauthorized());

        String habitBody = """
                {"name":"Read","description":"Read a little","category":"Learning",
                 "color":"#a4e276","target":"10 pages","weekdays":[0,1,2,3,4,5,6]}
                """;
        JsonNode habit = json.readTree(mvc.perform(post("/api/habits")
                        .header("Authorization", bearer(tokenA))
                        .header("X-Time-Zone", "Asia/Kolkata")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(habitBody))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        String habitId = habit.get("id").asText();
        String completionDate = LocalDate.now(ZoneId.of("Asia/Kolkata")).toString();

        mvc.perform(put("/api/habits/{id}/completions/{date}", habitId, completionDate)
                        .header("Authorization", bearer(tokenA)))
                .andExpect(status().isNoContent());
        mvc.perform(put("/api/habits/{id}/completions/{date}", habitId, completionDate)
                        .header("Authorization", bearer(tokenA)))
                .andExpect(status().isNoContent());
        assertEquals(1, completions.findAllByHabit_IdOrderByCompletedOnAsc(UUID.fromString(habitId)).size());

        String editedHabit = """
                {"name":"Read thoughtfully","description":"A longer session","category":"Learning",
                 "color":"#a4e276","target":"20 pages","weekdays":[0,1,2,3,4,5,6]}
                """;
        mvc.perform(put("/api/habits/{id}", habitId)
                        .header("Authorization", bearer(tokenA))
                        .header("X-Time-Zone", "Asia/Kolkata")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(editedHabit))
                .andExpect(status().isOk());
        assertEquals(1, completions.findAllByHabit_IdOrderByCompletedOnAsc(UUID.fromString(habitId)).size());

        JsonNode analytics = json.readTree(mvc.perform(get("/api/analytics")
                        .header("Authorization", bearer(tokenA))
                        .header("X-Time-Zone", "Asia/Kolkata"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertEquals(1, analytics.get("scheduledToday").asInt());
        assertEquals(1, analytics.get("completedToday").asInt());

        mvc.perform(get("/api/habits").header("Authorization", bearer(tokenB)))
                .andExpect(status().isOk())
                .andExpect(result -> assertEquals("[]", result.getResponse().getContentAsString()));
        mvc.perform(delete("/api/habits/{id}", habitId).header("Authorization", bearer(tokenB)))
                .andExpect(status().isNotFound());
    }

    private String register(String email, String name) throws Exception {
        String body = json.writeValueAsString(java.util.Map.of(
                "name", name, "email", email, "password", "correct-horse-battery"));
        JsonNode response = json.readTree(mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        return response.get("token").asText();
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
