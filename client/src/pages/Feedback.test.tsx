// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

const submit = vi.fn();
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock("@/lib/trpc", () => ({ trpc: { feedback: { submit: { useMutation: (options?: { onSuccess?: () => void }) => ({ mutate: (input: { message: string }) => { submit(input); options?.onSuccess?.(); }, isPending: false, isSuccess: true }) } } } }));

import Feedback from "./Feedback";

describe("feedback section", () => {
  it("submits an authenticated user message", async () => {
    const user = userEvent.setup();
    render(<Feedback />);
    await user.type(screen.getByLabelText("Masukan Anda"), "Tolong tambahkan ringkasan tren malam hari.");
    await user.click(screen.getByRole("button", { name: /Kirim masukan/ }));
    expect(submit).toHaveBeenCalledWith({ message: "Tolong tambahkan ringkasan tren malam hari." });
  });
});
