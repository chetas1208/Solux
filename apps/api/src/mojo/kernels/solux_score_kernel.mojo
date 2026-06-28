"""
Solux weighted score aggregation kernel.
Input (stdin): space-separated pairs of score weight score weight ...
Output (stdout): single float — weighted average score 0-100

Build:
  mojo build solux_score_kernel.mojo -o solux_score_kernel_bin
Run:
  echo "85 0.25 90 0.20 70 0.15 80 0.15 75 0.10 70 0.05 72 0.05 68 0.05" | ./solux_score_kernel_bin
"""

from sys import stdin
from math import min, max


fn parse_float(s: String) -> Float64:
    """Simple float parser for space-separated input."""
    try:
        return Float64(s)
    except:
        return 0.0


fn main():
    # Read all tokens from stdin
    var line = stdin.readline()
    line = line.strip()

    if len(line) == 0:
        print("0.0")
        return

    var tokens = line.split(" ")
    var weighted_sum: Float64 = 0.0
    var weight_total: Float64 = 0.0

    var i = 0
    while i + 1 < len(tokens):
        var score = parse_float(tokens[i])
        var weight = parse_float(tokens[i + 1])
        weighted_sum += score * weight
        weight_total += weight
        i += 2

    var final_score: Float64 = 0.0
    if weight_total > 0.0:
        final_score = weighted_sum / weight_total

    # Clamp to 0-100
    final_score = max(0.0, min(100.0, final_score))

    print(final_score)
