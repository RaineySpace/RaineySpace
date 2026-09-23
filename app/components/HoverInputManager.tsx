"use client";

import { useLayoutEffect } from "react";
import { hoverInput } from "@/lib/hover-input";

export default function HoverInputManager() {
  useLayoutEffect(() => hoverInput.connect(window, document), []);
  return null;
}
