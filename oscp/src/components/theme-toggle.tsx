"use client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const isDark = theme === "dark" || (!theme && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  return (
    <Button variant="outline" size="sm" onClick={() => setTheme(isDark ? "light" : "dark")}>
      {isDark ? <Sun size={16} /> : <Moon size={16} />}<span className="ml-2 hidden sm:inline">Theme</span>
    </Button>
  );
}



