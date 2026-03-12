"use client";
import { useEffect } from "react";

export function ThemeProvider() {
    useEffect(() => {
        const saved = localStorage.getItem("deckgenius_theme");
        if (saved === "pop") {
            document.body.classList.add("theme-pop");
        } else {
            document.body.classList.remove("theme-pop");
        }
    }, []);
    return null;
}
