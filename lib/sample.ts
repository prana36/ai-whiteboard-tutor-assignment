import type { BoardElement, Lesson, Scene } from "./lesson";

function node(
  id: string,
  text: string,
  x: number,
  y: number,
  color: BoardElement["color"] = "purple",
  reveal = 0,
): BoardElement {
  return { id, kind: "rect", text, x, y, width: 200, height: 84, color, reveal };
}
function arrow(
  id: string,
  x: number,
  y: number,
  width: number,
  height = 0,
  reveal = 0.25,
  text = "",
): BoardElement {
  return { id, kind: "arrow", x, y, width, height, text, color: "ink", reveal };
}
function label(
  id: string,
  text: string,
  x: number,
  y: number,
  reveal = 0,
  color: BoardElement["color"] = "ink",
): BoardElement {
  return { id, kind: "text", text, x, y, width: 0, height: 0, color, reveal };
}

const scenes: Scene[] = [
  {
    title: "Learning from examples",
    narration:
      "How does a neural network learn to recognize a cat? Instead of giving it a list of rules, we show it examples. Each picture becomes numbers. The network transforms those numbers into a prediction, then uses feedback to improve. Let's follow one example through this learning loop.",
    takeaway:
      "A neural network learns patterns from examples, rather than a hand-written list of rules.",
    elements: [
      node("input", "Picture → numbers", 70, 180, "blue"),
      arrow("a", 280, 222, 100),
      node("network", "Neural network", 400, 180),
      arrow("b", 610, 222, 100, 0, 0.5),
      node("output", "Prediction: cat?", 730, 180, "green", 0.5),
      label("l", "Examples + feedback = learning", 500, 380, 0.75, "purple"),
    ],
  },
  {
    title: "Meet a single neuron",
    narration:
      "A neuron is a small calculation. It multiplies each input by a weight, adds the results and a bias, then applies an activation function. Weights control how strongly inputs matter. Think of a tiny decision maker combining clues, such as the edges and colors in our picture.",
    takeaway:
      "Weights change the influence of each input. An activation function adds nonlinearity.",
    elements: [
      node("x1", "Input x₁", 80, 90, "blue"),
      node("x2", "Input x₂", 80, 300, "blue"),
      arrow("w1", 290, 132, 140, 70, 0.2, "× w₁"),
      arrow("w2", 290, 342, 140, -90, 0.3, "× w₂"),
      node("sum", "Sum + bias", 450, 180),
      arrow("activation", 660, 222, 70, 0, 0.5),
      node("out", "Activation → output", 750, 180, "green", 0.5),
      label("formula", "y = activation(w₁x₁ + w₂x₂ + b)", 500, 460, 0.7, "purple"),
    ],
  },
  {
    title: "Build a network",
    narration:
      "Connect neurons into layers and we have a network. The input layer receives the picture's numbers. Hidden layers can combine simple clues into more useful patterns. The output gives a prediction. This trip from input to output is called the forward pass. Initially, its predictions are usually poor.",
    takeaway:
      "The forward pass carries information from inputs, through hidden layers, to a prediction.",
    elements: [
      label("il", "INPUT", 160, 70, 0, "blue"),
      label("hl", "HIDDEN LAYER", 490, 70, 0.2, "purple"),
      label("ol", "OUTPUT", 830, 70, 0.6, "green"),
      ...[130, 250, 370].map((y, i) => ({
        ...node(`i${i}`, ["Edges", "Colors", "Textures"][i], 60, y, "blue"),
        width: 180,
      })),
      ...[130, 250, 370].map((y, i) => ({
        ...node(`h${i}`, `Pattern ${i + 1}`, 400, y, "purple", 0.2),
        width: 180,
      })),
      arrow("c1", 250, 172, 140, 0, 0.3),
      arrow("c2", 250, 292, 140, 0, 0.35),
      arrow("c3", 250, 412, 140, 0, 0.4),
      arrow("c4", 590, 172, 120, 110, 0.5),
      arrow("c5", 590, 412, 120, -110, 0.55),
      node("prediction", "Cat: 40%", 730, 250, "green", 0.6),
    ],
  },
  {
    title: "Measure the mistake",
    narration:
      "Suppose our training picture really is a cat, but the network gives cat a low probability. A loss function measures how far that prediction is from the correct answer. A smaller loss means a better prediction on this example. Loss gives learning a target: reduce the error.",
    takeaway: "Loss turns a prediction mistake into a number the network can try to reduce.",
    elements: [
      node("prediction", "Prediction: 40% cat", 100, 120, "orange"),
      node("truth", "True label: cat", 100, 330, "green", 0.2),
      arrow("a", 310, 162, 180, 80, 0.35),
      arrow("b", 310, 372, 180, -80, 0.35),
      node("loss", "Loss function", 510, 220, "purple", 0.4),
      arrow("c", 720, 262, 70, 0, 0.6),
      { ...node("error", "Error", 810, 220, "orange", 0.6), width: 130 },
      label("target", "Our goal: make the loss smaller ↓", 550, 450, 0.8, "purple"),
    ],
  },
  {
    title: "Adjust, then try again",
    narration:
      "Backpropagation calculates how each weight contributed to the loss using derivatives. An optimizer then nudges weights in a direction that reduces it. The learning rate controls the size of each nudge. Repeat this across many examples, and useful patterns emerge. Training is many small corrections, not one magical leap.",
    takeaway: "Backpropagation computes gradients; the optimizer uses them to update the weights.",
    elements: [
      node("loss", "1. Measure loss", 80, 160, "orange"),
      arrow("a", 290, 202, 90),
      node("gradient", "2. Find gradients", 400, 160, "purple", 0.25),
      arrow("b", 610, 202, 90, 0, 0.45),
      node("update", "3. Update weights", 720, 160, "green", 0.45),
      arrow("return1", 820, 255, 0, 100, 0.7),
      arrow("return2", 820, 355, -630, 0, 0.7, "repeat with more examples"),
      arrow("return3", 190, 355, 0, -100, 0.7),
      label(
        "formula",
        "new weight = old weight − learning rate × gradient",
        500,
        470,
        0.8,
        "purple",
      ),
    ],
  },
  {
    title: "Learning that generalizes",
    narration:
      "There's one final test: can the network recognize cats it has never seen? Memorizing training examples is called overfitting. We evaluate on separate data to check generalization. Remember the cycle: predict, measure loss, update weights, repeat. The goal is useful patterns that work on new examples, not just familiar pictures.",
    takeaway:
      "Good learning generalizes to unseen examples. Check it with data kept separate from training.",
    elements: [
      node("train", "Training examples", 70, 160, "blue"),
      arrow("a", 280, 202, 100),
      node("model", "Learned patterns", 400, 160),
      arrow("b", 610, 202, 100, 0, 0.4),
      node("new", "Unseen pictures", 730, 160, "green", 0.4),
      label("not", "Memorization ≠ understanding", 500, 350, 0.6, "orange"),
      label("recap", "Predict → measure → update → repeat", 500, 450, 0.8, "purple"),
    ],
  },
];

export const sampleLesson: Lesson = {
  id: "sample-neural-networks",
  source: "sample",
  createdAt: "2026-11-16T00:00:00.000Z",
  title: "How neural networks learn",
  summary:
    "From a first guess to a better prediction. Meet the small learning loop behind neural networks.",
  scenes,
  suggestions: [
    "Explain backpropagation with a simple example",
    "What happens if the learning rate is too high?",
    "How is overfitting prevented?",
  ],
  quiz: {
    question: "Why do we test a network on pictures it hasn't trained on?",
    options: [
      "To make the training loss exactly zero",
      "To check whether it learned patterns that generalize",
      "To add more hidden layers",
    ],
    answerIndex: 1,
    explanation:
      "Unseen examples test generalization. A network can memorize its training data without learning patterns that work on new data.",
  },
};
