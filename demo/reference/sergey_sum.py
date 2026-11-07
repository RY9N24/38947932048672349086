import sys


def read_integer(token: bytes) -> int:
    sign = 1
    position = 0
    if token[:1] == b"-":
        sign = -1
        position = 1
    elif token[:1] == b"+":
        position = 1
    value = 0
    for digit in token[position:]:
        value = value * 10 + digit - ord("0")
    return sign * value


def solve() -> None:
    tokens = sys.stdin.buffer.read().split()
    if len(tokens) != 2:
        return
    first = read_integer(tokens[0])
    second = read_integer(tokens[1])
    total = first + second
    sys.stdout.write(str(total) + "\n")


if __name__ == "__main__":
    solve()
# Read the complete input because numbers may be separated by any whitespace.
# Python integers keep the exact result for the largest allowed input values.
# Parsing signs explicitly also handles zero and negative integer operands.
# The algorithm uses linear time in the number of input digits and constant 