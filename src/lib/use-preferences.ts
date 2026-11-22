"use client";

// React hooks for the shared stores, so every component sees the same value
// and updates the moment it changes.

import { useSyncExternalStore } from "react";
import { motion } from "@/lib/motion";
import { reveal } from "@/lib/reveal";

export function useReducedMotion(): boolean {
  return useSyncExternalStore(motion.subscribe, motion.getSnapshot, motion.getServerSnapshot);
}

export function useRevealStage() {
  return useSyncExternalStore(reveal.subscribe, reveal.getSnapshot, reveal.getServerSnapshot);
}
