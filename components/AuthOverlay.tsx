
import React, { useState } from 'react';
import { authService } from '../services/backendService';
import { Activity, Lock, User, ArrowRight } from 'lucide-react';

interface AuthOverlayProps {
    onLogin: (username: string) => void;
    theme: 'light' | 'dark';
}

const AuthOverlay: React.FC<AuthOverlayProps> = ({ onLogin, theme }) => {
    const [isRegister, setIsRegister] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (isRegister) {
            const success = await authService.register(username, password);
            if (success) {
                setIsRegister(false);
                setError('Registration successful! Please login.');
            } else {
                setError('Registration failed. Username may exist.');
            }
        } else {
            const result = await authService.login(username, password);
            if (result) {
                localStorage.setItem('chainscope_token', result.token);
                localStorage.setItem('chainscope_user', result.username);
                onLogin(result.username);
            } else {
                setError('Invalid credentials.');
            }
        }
        setLoading(false);
    };

    const bgMain = theme === 'light' ? 'bg-white' : 'bg-[#1a1a1a]';
    const textMain = theme === 'light' ? 'text-black' : 'text-white';
    const borderMain = theme === 'light' ? 'border-black' : 'border-gray-500';

    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center ${theme === 'light' ? 'bg-gray-100' : 'bg-black'} p-4`}>
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #888 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
            
            <div className={`w-full max-w-md ${bgMain} border-4 ${borderMain} neo-shadow-lg p-8 relative`}>
                <div className="flex justify-center mb-6">
                     <div className={`w-16 h-16 ${theme === 'light' ? 'bg-blue-600 border-black' : 'bg-blue-500 border-white'} border-2 flex items-center justify-center neo-shadow transform -rotate-3`}>
                        <Activity className="text-white w-8 h-8" />
                    </div>
                </div>
                
                <h2 className={`text-3xl font-black text-center mb-2 italic ${textMain}`}>CHAINSCOPE_V2</h2>
                <p className="text-center text-gray-500 font-mono text-xs mb-8 uppercase tracking-widest">
                    {isRegister ? 'Create Secure Data Vault' : 'Access Your Workspace'}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Username</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className={`w-full p-3 border-2 ${borderMain} font-bold outline-none focus:ring-2 focus:ring-blue-400 ${theme === 'light' ? 'bg-white' : 'bg-black text-white'}`}
                                placeholder="Enter username..."
                            />
                            <User className="absolute right-3 top-3 text-gray-400" size={18} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Password</label>
                        <div className="relative">
                            <input 
                                type="password" 
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className={`w-full p-3 border-2 ${borderMain} font-bold outline-none focus:ring-2 focus:ring-blue-400 ${theme === 'light' ? 'bg-white' : 'bg-black text-white'}`}
                                placeholder="••••••••"
                            />
                            <Lock className="absolute right-3 top-3 text-gray-400" size={18} />
                        </div>
                    </div>

                    {error && <div className="text-red-500 text-xs font-black text-center bg-red-100 p-2 border border-red-200">{error}</div>}

                    <button 
                        type="submit" 
                        disabled={loading}
                        className={`w-full py-4 mt-2 font-black text-lg uppercase tracking-widest border-2 ${borderMain} transition-all hover:-translate-y-1 neo-shadow-hover flex items-center justify-center gap-2 ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white'}`}
                    >
                        {loading ? 'Processing...' : (isRegister ? 'Register Account' : 'Login System')}
                        {!loading && <ArrowRight size={20} />}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button 
                        onClick={() => { setIsRegister(!isRegister); setError(''); }}
                        className="text-xs font-bold underline decoration-2 underline-offset-4 text-gray-500 hover:text-blue-600"
                    >
                        {isRegister ? 'Already have an account? Login' : 'New User? Create Account'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthOverlay;
