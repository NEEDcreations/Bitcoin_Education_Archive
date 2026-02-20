export interface Article {
  id: string;
  category: 'lightning' | 'nodes' | 'help-desk' | 'global' | 'market';
  title: string;
  summary: string;
  content: string;
  tags: string[];
  date: string;
}

export const categories = [
  { id: 'lightning', name: 'Lightning Network', icon: 'Zap', color: 'text-yellow-400' },
  { id: 'nodes', name: 'Node Operations', icon: 'Server', color: 'text-blue-400' },
  { id: 'help-desk', name: 'Fundamentals', icon: 'HelpCircle', color: 'text-purple-400' },
  { id: 'global', name: 'Global Adoption', icon: 'Globe', color: 'text-green-400' },
  { id: 'market', name: 'Market Analysis', icon: 'TrendingUp', color: 'text-orange-400' },
];

export const articles: Article[] = [
  {
    id: 'airport-analogy',
    category: 'lightning',
    title: 'The Airport Analogy',
    summary: 'Explaining how Lightning works using an airport hub-and-spoke system.',
    date: '2024-09-26',
    tags: ['education', 'analogies', 'basics'],
    content: `
      <h2>How Lightning Works: Simple Analogies</h2>
      <p>Think of Bitcoin as the heavy infrastructure—the runways and the massive cargo planes that move enormous wealth across the globe. It's secure, but it's slow and expensive to fire up a jet just to deliver a single cup of coffee.</p>
      
      <h3>The Hub-and-Spoke System</h3>
      <p>Lightning is like the local courier service at the airport. Instead of moving the big planes (on-chain transactions), we set up "terminals" (channels) between people. Once the terminal is open, you can send thousands of small packages (satoshi) back and forth instantly with almost zero cost.</p>
      
      <p>You only need to use the big runway (Bitcoin blockchain) twice: once to open the terminal and once to close it and settle your final balance.</p>
    `
  },
  {
    id: 'bar-tab-analogy',
    category: 'lightning',
    title: 'The Bar Tab Analogy',
    summary: 'Understanding payment channels through the lens of a local pub.',
    date: '2024-09-26',
    tags: ['education', 'channels'],
    content: `
      <h2>The Bar Tab Concept</h2>
      <p>Imagine you go to a bar. Instead of paying with your credit card every single time you order a beer (which would be slow and annoying), you "open a tab."</p>
      
      <h3>Opening the Tab</h3>
      <p>Opening the tab is like an on-chain Bitcoin transaction. You give the bartender your card (lock some BTC in a channel).</p>
      
      <h3>Ordering Drinks</h3>
      <p>Every time you get a drink, the bartender just scribbles a note on a coaster. This is a Lightning payment. It is instant, and no money has actually moved yet—just the "promise" or the update of who owes what.</p>
      
      <h3>Closing the Tab</h3>
      <p>At the end of the night, you pay the total. The bartender runs your card for the final amount. This single transaction on your statement (the blockchain) represents all the drinks you had all night.</p>
    `
  },
  {
    id: 'byzantine-problem',
    category: 'help-desk',
    title: 'Byzantine Generals Problem',
    summary: 'Solving the problem of consensus in a distributed system without trust.',
    date: '2024-09-26',
    tags: ['consensus', 'theory'],
    content: `
      <h2>The Foundation of Consensus</h2>
      <p>How do thousands of computers, many of which might be evil or broken, agree on the truth without a king or a central bank?</p>
      
      <h3>The Dilemma</h3>
      <p>Imagine several generals surrounding a city. They can only win if they all attack at the same time. If some attack and some retreat, they fail. They are far apart and can only send messengers. BUT, some generals might be traitors who want to send fake messages to confuse the rest.</p>
      
      <h3>The Bitcoin Solution: Proof of Work</h3>
      <p>Satoshi solved this by requiring "Proof of Work." To send a valid message (a block), a general must spend a massive amount of energy solving a puzzle. This makes it too expensive to lie and creates a clear, undeniable chain of truth that everyone can follow.</p>
    `
  }
];
