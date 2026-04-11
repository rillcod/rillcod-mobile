export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type MissionLanguage = 'javascript' | 'python' | 'html' | 'robotics';

export interface Mission {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  language: MissionLanguage;
  xp: number;
  starterCode: string;
  instructions: string;
  tags: string[];
}

export const MISSIONS: Mission[] = [
  {
    id: 'm01',
    title: 'Hello, Variables!',
    description: 'Declare variables and print your name, age, and favourite subject.',
    instructions:
      'Create three variables: name (string), age (number), and subject (string). Then print all three using console.log or print, formatted as a sentence.',
    difficulty: 'Beginner',
    language: 'javascript',
    xp: 50,
    starterCode: `// Declare your variables here\nconst name = '';\nconst age = 0;\nconst subject = '';\n\n// Print them\nconsole.log(\`My name is \${name}, I am \${age} years old and I love \${subject}\`);`,
    tags: ['variables', 'strings', 'console'],
  },
  {
    id: 'm02',
    title: 'Loop the Loop',
    description: 'Use a for loop to print numbers from 1 to 10.',
    instructions:
      'Write a for loop that iterates from 1 to 10 (inclusive) and prints each number. Then modify it to print only even numbers.',
    difficulty: 'Beginner',
    language: 'javascript',
    xp: 60,
    starterCode: `// Print numbers 1 to 10\nfor (let i = 1; i <= 10; i++) {\n  console.log(i);\n}\n\n// Now print only even numbers\n`,
    tags: ['loops', 'for loop', 'iteration'],
  },
  {
    id: 'm03',
    title: 'Function Factory',
    description: 'Write a function that calculates the area of a rectangle.',
    instructions:
      'Create a function called calculateArea that accepts width and height as parameters and returns their product. Test it with at least 3 different inputs.',
    difficulty: 'Beginner',
    language: 'javascript',
    xp: 70,
    starterCode: `function calculateArea(width, height) {\n  // your code here\n}\n\nconsole.log(calculateArea(5, 3));   // 15\nconsole.log(calculateArea(10, 7));  // 70\nconsole.log(calculateArea(2, 9));   // 18`,
    tags: ['functions', 'parameters', 'return values'],
  },
  {
    id: 'm07',
    title: 'Python Basics',
    description: 'Write a Python program that classifies numbers as positive, negative, or zero.',
    instructions:
      'Write a Python function classify_number(n) that returns "positive", "negative", or "zero". Test it with a list of numbers using a for loop.',
    difficulty: 'Beginner',
    language: 'python',
    xp: 70,
    starterCode: `def classify_number(n):\n    # return "positive", "negative", or "zero"\n    pass\n\nnumbers = [10, -3, 0, 42, -7, 0, 5]\n\nfor num in numbers:\n    print(f"{num} is {classify_number(num)}")`,
    tags: ['python', 'conditionals', 'functions'],
  },
  {
    id: 'r01',
    title: 'Blink an LED',
    description: 'Write your first Arduino sketch to blink the built-in LED on and off.',
    instructions:
      'Complete the Arduino sketch so the built-in LED (pin 13) blinks: ON for 1 second, OFF for 1 second, forever.',
    difficulty: 'Beginner',
    language: 'robotics',
    xp: 60,
    starterCode: `const int LED_PIN = 13;\n\nvoid setup() {\n  pinMode(LED_PIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_PIN, HIGH);\n  delay(1000);\n  // YOUR CODE HERE\n}`,
    tags: ['Arduino', 'LED', 'blink'],
  }
  // ... more missions from the web project can be added in the same pattern
];
