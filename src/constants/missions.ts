export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type MissionLanguage = 'javascript' | 'python' | 'html' | 'robotics';

export interface Mission {
  id: string;
  title: string;
  description: string;
  instructions: string;
  difficulty: Difficulty;
  language: MissionLanguage;
  xp: number;
  starterCode: string;
  tags: string[];
}

export const MISSIONS: Mission[] = [
  {
    id: 'm-js-1',
    title: 'Hello, Variables',
    description: 'Declare values and print a student intro sentence.',
    instructions: 'Create three variables for name, age, and favorite subject. Print them in one clear sentence.',
    difficulty: 'Beginner',
    language: 'javascript',
    xp: 50,
    starterCode: "const name = '';\nconst age = 0;\nconst subject = '';\nconsole.log(`My name is ${name}, I am ${age}, and I love ${subject}.`);",
    tags: ['variables', 'strings', 'intro'],
  },
  {
    id: 'm-js-2',
    title: 'Loop the numbers',
    description: 'Print numbers and separate odd from even values.',
    instructions: 'Use a loop from 1 to 10 and label each number as odd or even.',
    difficulty: 'Beginner',
    language: 'javascript',
    xp: 60,
    starterCode: "for (let i = 1; i <= 10; i++) {\n  const label = i % 2 === 0 ? 'even' : 'odd';\n  console.log(i, label);\n}",
    tags: ['loops', 'control-flow'],
  },
  {
    id: 'm-py-1',
    title: 'Python classifier',
    description: 'Classify numbers as positive, negative, or zero.',
    instructions: 'Write a function classify_number and test it against a list of values.',
    difficulty: 'Beginner',
    language: 'python',
    xp: 65,
    starterCode: "def classify_number(n):\n    if n > 0:\n        return 'positive'\n    if n < 0:\n        return 'negative'\n    return 'zero'\n\nfor value in [10, -3, 0, 7]:\n    print(value, classify_number(value))",
    tags: ['python', 'functions'],
  },
  {
    id: 'm-html-1',
    title: 'DOM detective',
    description: 'Update page content after a click.',
    instructions: 'Connect a button to a heading and paragraph so the page changes state when launched.',
    difficulty: 'Intermediate',
    language: 'html',
    xp: 90,
    starterCode: "<h1 id=\"heading\">Welcome</h1>\n<p id=\"status\">Idle</p>\n<button onclick=\"launch()\">Launch</button>\n<script>\nfunction launch() {\n  document.getElementById('heading').textContent = 'Mission Started';\n  document.getElementById('status').textContent = 'System online';\n}\n</script>",
    tags: ['dom', 'events'],
  },
  {
    id: 'm-js-3',
    title: 'Sort and search',
    description: 'Use arrays to sort values and find a target efficiently.',
    instructions: 'Sort a score list and then implement a binary-search-style lookup.',
    difficulty: 'Intermediate',
    language: 'javascript',
    xp: 110,
    starterCode: "const scores = [72, 55, 91, 40, 88];\nconst sorted = [...scores].sort((a, b) => a - b);\nconsole.log(sorted);\n\nfunction hasScore(target) {\n  return sorted.includes(target);\n}\n\nconsole.log(hasScore(88));",
    tags: ['arrays', 'sorting'],
  },
  {
    id: 'm-robot-1',
    title: 'Obstacle response',
    description: 'Describe a robot reaction when distance gets too small.',
    instructions: 'Build the logic steps for reading ultrasonic distance and stopping a robot when needed.',
    difficulty: 'Intermediate',
    language: 'robotics',
    xp: 120,
    starterCode: "Read distance\nIf distance < 10cm\n  Stop motors\n  Turn right\nElse\n  Move forward",
    tags: ['robotics', 'sensors'],
  },
  {
    id: 'm-py-2',
    title: 'Student report objects',
    description: 'Model student records with structured data.',
    instructions: 'Create student dictionaries, calculate average score, and print a clean report card.',
    difficulty: 'Intermediate',
    language: 'python',
    xp: 105,
    starterCode: "students = [\n  {'name': 'Aisha', 'scores': [80, 70, 90]},\n  {'name': 'Tobi', 'scores': [65, 88, 75]},\n]\n\nfor student in students:\n    average = sum(student['scores']) / len(student['scores'])\n    print(student['name'], average)",
    tags: ['data', 'reports'],
  },
  {
    id: 'm-js-4',
    title: 'Async fetch flow',
    description: 'Handle loading, success, and failure when calling a remote service.',
    instructions: 'Create an async function that fetches JSON and handles errors gracefully.',
    difficulty: 'Advanced',
    language: 'javascript',
    xp: 150,
    starterCode: "async function loadProfile() {\n  try {\n    const response = await fetch('https://example.com/profile');\n    const data = await response.json();\n    console.log(data);\n  } catch (error) {\n    console.log('Failed to load');\n  }\n}",
    tags: ['async', 'api'],
  },
  {
    id: 'm-html-2',
    title: 'Registration form',
    description: 'Build a simple form with validation messaging.',
    instructions: 'Create a form for name and email and show an error if either field is empty.',
    difficulty: 'Advanced',
    language: 'html',
    xp: 145,
    starterCode: "<form id=\"reg\">\n  <input id=\"name\" placeholder=\"Name\" />\n  <input id=\"email\" placeholder=\"Email\" />\n  <button type=\"button\" onclick=\"submitForm()\">Submit</button>\n</form>\n<p id=\"error\"></p>\n<script>\nfunction submitForm() {\n  const name = document.getElementById('name').value;\n  const email = document.getElementById('email').value;\n  if (!name || !email) {\n    document.getElementById('error').textContent = 'All fields are required';\n  }\n}\n</script>",
    tags: ['form', 'validation'],
  },
  {
    id: 'm-robot-2',
    title: 'Capstone checklist',
    description: 'Prepare the final build flow like a real delivery sequence.',
    instructions: 'List and order the input, control, output, and report steps for a robot build.',
    difficulty: 'Advanced',
    language: 'robotics',
    xp: 170,
    starterCode: "1. Confirm sensor wiring\n2. Test motion logic\n3. Observe output\n4. Record faults\n5. Publish final notes",
    tags: ['capstone', 'workflow'],
  },
];

export type LangFilter = 'all' | MissionLanguage;

export const MISSION_LANG_FILTERS: { key: LangFilter; label: string }[] = [
  { key: 'all', label: 'All Languages' },
  { key: 'javascript', label: 'JavaScript' },
  { key: 'python', label: 'Python' },
  { key: 'html', label: 'Web' },
  { key: 'robotics', label: 'Robotics' },
];
