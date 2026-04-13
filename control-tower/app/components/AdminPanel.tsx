"use client";
import { useState, useTransition } from 'react';
import { createUserAction, deleteUserAction } from "@/app/actions/user";
import LogoutButton from './LogoutButton';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
}

export default function AdminPanel({ initialUsers, session }: { initialUsers: User[], session: any }) {
  const [role, setRole] = useState('viewer');
  const [isPending, startTransition] = useTransition();
  const roles = ['admin', 'investigator', 'viewer'];

  async function clientAction(formData: FormData) {
    formData.append("role", role);
    
    startTransition(async () => {
      const result = await createUserAction(formData);
      if (result?.error) {
        alert(result.error);
      } else {
        alert("Access Granted: User provisioned successfully.");
      }
    });
  }


  async function handleRevoke(userId: string, userName: string, userEmail: string) {
    if (userEmail === session?.user?.email) {
      alert("CRITICAL ERROR: You cannot revoke your own administrative access.");
      return;
    }

    if (confirm(`CAUTION: You are about to revoke access for ${userName}. Proceed?`)) {
      startTransition(async () => {
        const result = await deleteUserAction(userId);
        if (result?.error) {
          alert(result.error);
        }
      });
    }
  }

  return (
    <main className="flex-1 flex flex-col bg-[#141414] text-white font-sans overflow-hidden">
      
      <div className="px-10 pt-8 flex justify-between items-end">
        <div>
          <h1 className="text-gray-500 text-[10px] uppercase tracking-[0.2em]">Authorized Session</h1>
          <p className="text-xl font-medium">
            {session?.user?.name} <span className="text-[#CAFF33] text-xs ml-2">● ONLINE</span>
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-6 p-6 md:p-10 overflow-hidden">
        
        <section className="w-full md:w-1/3 bg-[#1C1C1C] p-6 rounded-2xl border border-gray-800 shadow-xl flex flex-col justify-center">
          <header className="mb-6">
            <h1 className="text-[#CAFF33] text-2xl font-semibold">System Access</h1>
            <p className="text-gray-400 text-sm">Provision new credentials for the network.</p>
          </header>

          <form action={clientAction} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-gray-500 ml-1">Assign Role</label>
              <div className="flex p-1 bg-[#141414] rounded-lg border border-gray-800 gap-1">
                {roles.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${
                      role === r ? "bg-[#262626] text-[#CAFF33] border border-gray-700" : "text-gray-500"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <input 
                name="name" 
                type="text" 
                placeholder="Full Name" 
                required
                className="w-full bg-[#141414] border border-gray-800 p-3 rounded-lg text-sm focus:border-[#CAFF33] outline-none transition-all placeholder:text-gray-600" 
              />
              <input 
                name="email" 
                type="email" 
                placeholder="Email Address" 
                required
                className="w-full bg-[#141414] border border-gray-800 p-3 rounded-lg text-sm focus:border-[#CAFF33] outline-none transition-all placeholder:text-gray-600" 
              />
              <input 
                name="password" 
                type="password" 
                placeholder="Temporary Password" 
                required
                className="w-full bg-[#141414] border border-gray-800 p-3 rounded-lg text-sm focus:border-[#CAFF33] outline-none transition-all placeholder:text-gray-600" 
              />
            </div>

            <button 
              type="submit" 
              disabled={isPending}
              className="w-full bg-[#CAFF33] cursor-pointer hover:bg-[#afd149] py-3 rounded-lg font-bold text-black text-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "PROVISIONING..." : `CREATE ${role.toUpperCase()} ACCOUNT`}
            </button>
          </form>
        </section>

        <section className="flex-1 bg-[#1C1C1C] p-6 rounded-2xl border border-gray-800 shadow-xl overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Active Personnel</h2>
            <span className="bg-[#262626] text-gray-400 text-[10px] px-3 py-1 rounded-full border border-gray-700">
              {initialUsers.length} Total Users
            </span>
          </div>

          <div className="overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {initialUsers.map((user) => (
              <div key={user._id} className="flex items-center justify-between p-4 bg-[#141414] rounded-xl border border-gray-800 hover:border-gray-700 transition-all group">
                <div>
                  <p className="font-medium text-sm">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-[10px] font-mono px-2 py-1 rounded border ${
                    user.role === 'admin' 
                      ? 'text-[#CAFF33] border-[#CAFF33]/30 bg-[#CAFF33]/5' 
                      : 'text-gray-400 border-gray-700 bg-gray-800/20'
                  }`}>
                    {user.role}
                  </span>
                  {user.role !== "admin" && (
                    <button 
                      onClick={() => handleRevoke(user._id, user.name, user.email)}
                      className="text-red-900 text-[10px] uppercase font-bold hover:text-red-500 transition-colors opacity-60 group-hover:opacity-100"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}