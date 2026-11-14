export const CHEATSHEETS = [
  {
    id: "cpp",
    label: "C++",
    lang: "cpp",
    items: [
      {
        title: "Szybkie I/O + Szablon",
        code: `#include <iostream>\n#include <vector>\n#include <algorithm>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    return 0;\n}`
      },
      {
        title: "Vector, pętla range-based i sortowanie",
        code: `vector<int> v = {5, 1, 4, 2};\nv.push_back(9);\nsort(v.begin(), v.end()); // rosnąco\nsort(v.begin(), v.end(), greater<int>()); // malejąco\n\nfor (const auto& x : v) {\n    cout << x << " ";\n}`
      },
      {
        title: "Mapa (unordered_map) i zbiór (set)",
        code: `#include <unordered_map>\n#include <set>\n\nunordered_map<string, int> licznik;\nlicznik["cpp"]++;\nif (licznik.count("cpp")) { /* istnieje */ }\n\nset<int> unikalne = {3, 1, 2, 1}; // {1, 2, 3}`
      },
      {
        title: "Smart Pointers & Lambda",
        code: `#include <memory>\nauto ptr = make_unique<int>(42);\n\nauto dodaj = [](int a, int b) -> int {\n    return a + b;\n};`
      }
    ]
  },
  {
    id: "python",
    label: "Python",
    lang: "python",
    items: [
      {
        title: "List & Dict Comprehension",
        code: `kwadraty = [x**2 for x in range(10) if x % 2 == 0]\noceny = {k: v for k, v in zip(["Jan", "Ala"], [4.5, 5.0])}`
      },
      {
        title: "Pliki (with open) i JSON",
        code: `import json\n\nwith open("dane.txt", "r", encoding="utf-8") as f:\n    linie = [l.strip() for l in f]\n\nwith open("out.json", "w", encoding="utf-8") as f:\n    json.dump({"ok": True}, f, ensure_ascii=False, indent=2)`
      },
      {
        title: "F-stringi, enumerate, zip",
        code: `pi = 3.14159\nprint(f"Wartość: {pi:.2f}")\n\nfor idx, val in enumerate(["a", "b"], start=1):\n    print(idx, val)`
      },
      {
        title: "Dataclass (czyste klasy danych)",
        code: `from dataclasses import dataclass\n\n@dataclass\nclass Punkt:\n    x: float\n    y: float = 0.0`
      }
    ]
  },
  {
    id: "matplotlib",
    label: "Matplotlib",
    lang: "python",
    items: [
      {
        title: "Kompletny wykres liniowy (OOP API)",
        code: `import matplotlib.pyplot as plt\nimport numpy as np\n\nx = np.linspace(0, 10, 100)\nfig, ax = plt.subplots(figsize=(8, 4.5), dpi=120)\nax.plot(x, np.sin(x), label="sin(x)", color="#7c3aed", lw=2)\nax.set_title("Przebieg czasowy")\nax.set_xlabel("Czas [s]")\nax.set_ylabel("Amplituda [V]")\nax.grid(True, linestyle="--", alpha=0.4)\nax.legend()\nplt.tight_layout()\nplt.show()`
      },
      {
        title: "Siatka wykresów (Subplots) + Scatter/Hist",
        code: `fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 4))\nax1.scatter(x, y, c="red", alpha=0.6, s=25)\nax1.set_title("Rozrzut")\n\nax2.hist(y, bins=20, edgecolor="black")\nax2.set_title("Histogram")\nplt.tight_layout()`
      },
      {
        title: "Zapis wykresu do pliku (wysoka jakość)",
        code: `fig.savefig("wykres.png", dpi=300, bbox_inches="tight")`
      }
    ]
  },
  {
    id: "sql",
    label: "SQL",
    lang: "sql",
    items: [
      {
        title: "SELECT + JOIN + GROUP BY + HAVING",
        code: `SELECT s.imie, COUNT(o.id) AS ile_ocen, AVG(o.wartosc) AS srednia\nFROM studenci s\nLEFT JOIN oceny o ON s.id = o.student_id\nWHERE s.rok = 2\nGROUP BY s.id, s.imie\nHAVING AVG(o.wartosc) >= 3.5\nORDER BY srednia DESC;`
      },
      {
        title: "INSERT / UPDATE / DELETE",
        code: `INSERT INTO przedmioty (nazwa, ects) VALUES ('Bazy Danych', 5);\nUPDATE przedmioty SET ects = 6 WHERE nazwa = 'Bazy Danych';\nDELETE FROM przedmioty WHERE id = 10;`
      },
      {
        title: "Funkcje okna (Window Functions) i CTE",
        code: `WITH ranking AS (\n  SELECT imie, punkty,\n         RANK() OVER (ORDER BY punkty DESC) AS pozycja\n  FROM wyniki\n)\nSELECT * FROM ranking WHERE pozycja <= 5;`
      }
    ]
  },
  {
    id: "freecad",
    label: "FreeCAD",
    lang: "plaintext",
    items: [
      {
        title: "Part Design – prawidłowy workflow",
        code: `1. Workbench: Part Design -> Create Body\n2. Create Sketch -> wybierz płaszczyznę (XY / XZ / YZ)\n3. Geometria + Więzy (Constraints):\n   - C = Coincident (styk punktów)\n   - H / V = Poziomo / Pionowo\n   - D = Wymiar (Distance / Radius)\n   - E = Równość (Equal)\n4. Zielony szkic = Fully Constrained (0 DoF)\n5. Zamknij szkic -> Pad (wyciągnięcie) lub Pocket (wycięcie)`
      },
      {
        title: "Nawigacja i widoki (CAD / Gesture)",
        code: `Widok: 0 (Izometria), 1 (Przód), 2 (Góra), 3 (Prawo)\nV, F -> Fit All (dopasuj model do ekranu)\nSpacja -> Ukryj / Pokaż zaznaczony obiekt\nV, S -> Przełącz cieniowanie / krawędzie`
      },
      {
        title: "Projektowanie parametryczne (Spreadsheet)",
        code: `1. Workbench: Spreadsheet -> utwórz arkusz\n2. Wpisz wartość w komórkę -> Prawy klik -> Properties -> Alias (np. "grubosc")\n3. W wymiarze szkicu kliknij ikonę f(x) i wpisz:\n   <<Spreadsheet>>.grubosc`
      }
    ]
  },
  {
    id: "blender",
    label: "Blender",
    lang: "plaintext",
    items: [
      {
        title: "Transformacje (Object & Edit Mode)",
        code: `G -> Grab (Przesuń) | R -> Rotate (Obróć) | S -> Scale (Skaluj)\n+ X / Y / Z -> blokada wybranej osi (np. G -> Z -> 2 -> Enter)\n+ Shift + X/Y/Z -> ruch na płaszczyźnie (wszystko oprócz tej osi)\nCtrl + A -> Apply Scale / Rotation (kluczowe przed Bevel/Modyfikatorami!)`
      },
      {
        title: "Edit Mode (Tab) – Modelowanie siatki",
        code: `1 / 2 / 3 -> Wybór: Vertex / Edge / Face\nE -> Extrude (Wytłoczenie)\nI -> Inset Faces (Wcięcie)\nCtrl + B -> Bevel (Fazowanie; scroll = ilość segmentów)\nCtrl + R -> Loop Cut (Cięcie pętli)\nM -> Merge (Łączenie wierzchołków, np. At Center)\nShift + D -> Duplikuj | X -> Usuń`
      },
      {
        title: "Widok, kamera i cieniowanie",
        code: `Środkowy przycisk (MMB) -> Obrót | Shift + MMB -> Przesuwanie\nNumpad . (kropka) -> Przybliż do zaznaczonego obiektu\nNumpad 0 -> Widok z kamery | Ctrl+Alt+Numpad 0 -> Ustaw kamerę na aktualny widok\nZ -> Pie menu (Wireframe / Solid / Material Preview / Rendered)\nShift + A -> Dodaj nowy obiekt / światło / modyfikator`
      }
    ]
  }
];
