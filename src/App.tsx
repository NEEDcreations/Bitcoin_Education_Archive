import { useState, useMemo, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Zap, Server, HelpCircle, Globe, TrendingUp, Search, 
  ArrowLeft, BookOpen, ExternalLink, Shield
} from 'lucide-react';
import { articles, categories, Article } from './data/content';
import classNames from 'classnames';

// --- Components ---

const Navbar = () => (
  <nav className="bg-slate-900/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-50 px-4 py-3">
    <div className="max-w-7xl mx-auto flex items-center justify-between">
      <Link to="/" className="flex items-center gap-3">
        <div className="bg-orange-500 p-1.5 rounded-lg">
          <Zap className="text-white w-5 h-5 fill-white" />
        </div>
        <span className="font-bold text-lg tracking-tight">Archive</span>
      </Link>
      
      <div className="flex items-center gap-4">
        <a 
          href="https://needcreations.github.io/Frontier_Forge/" 
          className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-orange-400 flex items-center gap-2 transition-all"
        >
          <ArrowLeft className="w-3 h-3" /> Frontier Forge
        </a>
      </div>
    </div>
  </nav>
);

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const ArticleCard = ({ article }: { article: Article }) => {
  const Icon = {
    lightning: Zap,
    nodes: Server,
    'help-desk': HelpCircle,
    global: Globe,
    market: TrendingUp
  }[article.category];

  const cat = categories.find(c => c.id === article.category);

  return (
    <Link to={`/article/${article.id}`} className="block group">
      <div className="bg-slate-900/40 border border-white/5 group-hover:border-orange-500/30 rounded-2xl p-6 h-full transition-all duration-300 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-orange-500/10 transition-colors" />
        
        <div className="flex items-start justify-between mb-6">
          <div className={classNames("p-2.5 rounded-xl bg-slate-950/50 border border-white/5", cat?.color)}>
            <Icon size={20} />
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">{article.date}</span>
        </div>
        
        <h3 className="text-xl font-bold mb-3 group-hover:text-white transition-colors">{article.title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed mb-6 line-clamp-2">{article.summary}</p>
        
        <div className="flex flex-wrap gap-2 mt-auto">
          {article.tags.slice(0, 2).map(tag => (
            <span key={tag} className="text-[10px] uppercase font-black bg-slate-950/80 px-2 py-1 rounded text-slate-600 border border-white/5">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
};

// --- Pages ---

const HomePage = () => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  
  const filteredArticles = useMemo(() => 
    articles.filter(a => {
      const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase()) || 
                          a.summary.toLowerCase().includes(search.toLowerCase());
      const matchesCat = activeCategory ? a.category === activeCategory : true;
      return matchesSearch && matchesCat;
    }), [search, activeCategory]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-16 md:py-24">
      {/* Hero */}
      <div className="text-center mb-20">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 bg-slate-900/50 border border-white/10 px-4 py-1.5 rounded-full mb-8"
        >
          <Shield className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Restored from Discord Backup • 2026 Archive</span>
        </motion.div>
        
        <h1 className="text-5xl md:text-8xl font-black mb-8 tracking-tighter lowercase">
          bitcoin <span className="text-orange-500 italic">education</span>
        </h1>
        <p className="text-slate-500 text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
          The curated collection of analogies, guides, and technical insights from the global Bitcoin Education community.
        </p>
        
        <div className="relative max-w-xl mx-auto z-10">
          <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-purple-600 rounded-full opacity-20 blur" />
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Search analogies, guides, RBF, nodes..."
              className="w-full bg-slate-900 border border-white/10 rounded-full py-5 pl-14 pr-7 focus:outline-none focus:border-orange-500/50 transition-all text-white placeholder-slate-600 shadow-2xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Cat filters */}
      <div className="flex flex-wrap justify-center gap-3 mb-16">
        <button 
          onClick={() => setActiveCategory(null)}
          className={classNames(
            "px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all border",
            !activeCategory ? "bg-orange-500 border-orange-400 text-white" : "bg-slate-900 border-white/5 text-slate-500 hover:border-white/10"
          )}
        >
          All
        </button>
        {categories.map(cat => (
          <button 
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={classNames(
              "px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all border shrink-0",
              activeCategory === cat.id ? "bg-white text-slate-950 border-white" : "bg-slate-900 border-white/5 text-slate-500 hover:border-white/20"
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filteredArticles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredArticles.map(article => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-slate-900/20 rounded-3xl border border-dashed border-white/5">
          <p className="text-slate-600 font-mono">No results found for your search.</p>
        </div>
      )}
    </div>
  );
};

const ArticlePage = () => {
  const { id } = useParams();
  const article = articles.find(a => a.id === id);
  const navigate = useNavigate();

  if (!article) return <div className="p-20 text-center font-mono text-slate-600">Article not recovered.</div>;

  return (
    <div className="max-w-4xl mx-auto px-6 py-16 md:py-24">
      <button 
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-slate-500 hover:text-white mb-16 transition-colors group text-xs font-black uppercase tracking-widest"
      >
        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" /> Back to Library
      </button>

      <div className="mb-20">
        <div className="inline-block px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded-md text-[10px] font-black text-orange-500 uppercase tracking-widest mb-6">
          {categories.find(c => c.id === article.category)?.name}
        </div>
        <h1 className="text-5xl md:text-7xl font-black mb-8 leading-[0.9] tracking-tighter text-white">{article.title}</h1>
        <div className="flex items-center gap-4 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
           Source Backup: {article.date}
        </div>
      </div>

      <div 
        className="prose prose-invert max-w-none 
          [&>h2]:text-3xl [&>h2]:font-black [&>h2]:mt-16 [&>h2]:mb-8 [&>h2]:text-white [&>h2]:tracking-tight
          [&>h3]:text-xl [&>h3]:font-bold [&>h3]:mt-12 [&>h3]:mb-4 [&>h3]:text-orange-400
          [&>p]:text-slate-400 [&>p]:leading-relaxed [&>p]:mb-6 text-xl"
        dangerouslySetInnerHTML={{ __html: article.content }} 
      />
      
      <div className="mt-24 pt-12 border-t border-white/5 flex justify-between items-center">
        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">End of Entry</div>
        <button onClick={() => navigate('/')} className="text-orange-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest">Next Topic</button>
      </div>
    </div>
  );
};

// --- App ---

import { motion } from 'framer-motion';

function App() {
  return (
    <Router>
      <ScrollToTop />
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-orange-500 selection:text-white">
        {/* Animated grid bg */}
        <div className="fixed inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />
        
        <Navbar />
        <main className="relative z-10">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/article/:id" element={<ArticlePage />} />
          </Routes>
        </main>
        
        <footer className="border-t border-white/5 py-20 px-6 mt-20 relative z-10 bg-slate-950">
          <div className="max-w-7xl mx-auto text-center">
            <div className="flex justify-center gap-3 mb-8">
              <div className="w-8 h-1 bg-orange-500 rounded-full" />
              <div className="w-8 h-1 bg-slate-800 rounded-full" />
              <div className="w-8 h-1 bg-slate-800 rounded-full" />
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2">
              Bitcoin Education Archive
            </div>
            <div className="text-slate-700 text-xs">
              Part of the Frontier Forge Academy Knowledge Graph
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
