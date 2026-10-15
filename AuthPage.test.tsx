// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthPage } from "./App";

afterEach(cleanup);

describe("authentication form", () => {
  it("shows client-side validation and does not submit a short password", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AuthPage onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Create account" }));
    await user.type(screen.getByLabelText("Your name"), "Jamie Sample");
    await user.type(
      screen.getByLabelText("Email address"),
      "jamie@example.com",
    );
    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Use at least 8 characters.",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits validated registration credentials to the registration endpoint", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AuthPage onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Create account" }));
    await user.type(screen.getByLabelText("Your name"), "Jamie Sample");
    await user.type(
      screen.getByLabelText("Email address"),
      "jamie@example.com",
    );
    await user.type(screen.getByLabelText("Password"), "long-enough-password");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith("/auth/register", {
        name: "Jamie Sample",
        email: "jamie@example.com",
        password: "long-enough-password",
      }),
    );
  });
});
