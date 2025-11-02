import "./App.css";
import { Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./store/store";
import "primereact/resources/themes/lara-light-green/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import "primeflex/primeflex.css";
import Home from "./pages/Home";
function App() {
  return (
    <Provider store={store}>
        <Router>
          <Suspense fallback={<div>Loading...</div>}>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="*" element={<Home />} />
            </Routes>
          </Suspense>
        </Router>
    </Provider>
  );
}

export default App;
