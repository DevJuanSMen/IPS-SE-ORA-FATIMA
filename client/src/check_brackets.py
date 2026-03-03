def check_brackets(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    stack = []
    brackets = {'(': ')', '{': '}', '[': ']'}
    lines = content.split('\n')
    
    for i, line in enumerate(lines):
        for j, char in enumerate(line):
            if char in brackets:
                stack.append((char, i + 1, j + 1))
            elif char in brackets.values():
                if not stack:
                    print(f"Extra closing bracket '{char}' at line {i+1}, col {j+1}")
                else:
                    opening, line_num, col_num = stack.pop()
                    if brackets[opening] != char:
                        print(f"Mismatch: '{opening}' at line {line_num}, col {col_num} closed by '{char}' at line {i+1}, col {j+1}")
    
    while stack:
        opening, line_num, col_num = stack.pop()
        print(f"Unclosed bracket '{opening}' at line {line_num}, col {col_num}")

if __name__ == "__main__":
    import sys
    check_brackets(sys.argv[1])
