package com.MediZap.backend.controllers;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.annotation.GetMapping;

@RestController
@RequestMapping("/test/")
public class testpages {
  @GetMapping
  public String base() {
    return "working";
  }
}
