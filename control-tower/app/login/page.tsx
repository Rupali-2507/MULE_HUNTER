import Footer from "../components/Footer";
import LoginForm from "../components/LoginForm";
import Navbar from "../components/Navbar";

export default function Home() {
  return (
    <main className="h-screen overflow-hidden flex flex-col bg-[#141414] text-white font-sans selection:bg-[#CAFF33] selection:text-black">
      
      <Navbar/>
      
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <LoginForm />

        {/* Credentials Info */}
        <div className="mt-4 text-sm text-gray-400 text-center">
          <p className="text-[#CAFF33] font-medium">
            Admin Credentials (MVP Purpose only) 
          </p>
          <p>For demonstration purposes,
            you can use the following credentials:</p>
          <p>Email: admin@test.com</p>
          <p>Password: Test@123</p>
        </div>

      </div>

      <Footer/>
    </main>
  );
}