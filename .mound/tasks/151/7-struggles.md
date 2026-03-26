# Struggles

- **Category:** spec-clarity
  **What happened:** The paragraph-separator proximity test was hard to construct because the proximity gate and paragraph-boundary guard interact — a cross-paragraph clean tail triggers paragraph-boundary before proximity if the total distance is ≤100. The spec doesn't specify evaluation order relative to this interaction.
  **What would have helped:** The spec could explicitly state that proximity is evaluated before paragraph-boundary, or note that the guard order doesn't matter since all three must pass for eligibility.
