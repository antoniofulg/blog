(function () {
	try {
		var t = localStorage.getItem("theme");
		if (t !== "light" && t !== "dark" && t !== "cs16") {
			t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
		}
		var root = document.documentElement;
		root.classList.remove("dark", "cs16");
		if (t === "dark") root.classList.add("dark");
		else if (t === "cs16") root.classList.add("cs16");
	} catch (e) {}
})();
