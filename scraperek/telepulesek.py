import requests
from bs4 import BeautifulSoup
import re
import os

def scrape_telepulesek(url):
    """
    Lescrapeli a településneveket (epizódszám nélkül) az Ízőrzők weboldalról.
    """
    try:
        # Az oldal tartalmának letöltése
        response = requests.get(url)
        response.raise_for_status() # Hiba esetén kivételt dob

        # A HTML elemzése
        soup = BeautifulSoup(response.content, 'html.parser')

        # Keressük meg a legördülő menüt (select tag)
        select_element = soup.find('select') 
        
        if not select_element:
            print("Nem található SELECT elem az oldalon.")
            return []

        telepulesek_nevei = []
        
        # Iterálás az 'option' tageken belül
        for option in select_element.find_all('option'):
            telepules_text = option.text.strip()
            
            # Az "Települések" feliratot és az üres sorokat kihagyjuk
            if telepules_text == "Települések" or not telepules_text:
                continue

            # A szöveg tisztítása: elvágjuk az elemet a zárójel előtt.
            # Példa: "Abasár (6)" -> "Abasár"
            telepules_nev_tiszta = re.sub(r'\s*\(\d+\)$', '', telepules_text).strip()
            
            if telepules_nev_tiszta:
                telepulesek_nevei.append(telepules_nev_tiszta)

        return telepulesek_nevei

    except requests.exceptions.RequestException as e:
        print(f"Hiba történt a weboldal letöltése során: {e}")
        return []
    except Exception as e:
        print(f"Ismeretlen hiba: {e}")
        return []

def save_to_file(data_list, filename="telepulesek_lista.txt"):
    """
    Elmenti a lista elemeit egy fájlba, soronként egyet.
    """
    try:
        # Fájl megnyitása írásra (felülírja, ha már létezik)
        with open(filename, 'w', encoding='utf-8') as f:
            for item in data_list:
                f.write(item + '\n')
        
        print(f"\n✅ Sikeresen elmentve a(z) '{filename}' fájlba.")
        print(f"A fájl mérete: {os.path.getsize(filename)} bájt.")
    except IOError as e:
        print(f"\nHiba a fájlba írás során: {e}")

if __name__ == '__main__':
    URL = "https://www.izorzok.hu/helyszinek/"
    
    # 1. Scrapelés
    telepulesek = scrape_telepulesek(URL)

    if telepulesek:
        print(f"Sikeresen lescrapelt {len(telepulesek)} települést (epizódszám nélkül):\n")
        
        # Konzolkimenet az ellenőrzéshez
        for item in telepulesek[:10]:
            print(f"- {item}")
            
        print("\n...")
        
        # 2. Fájlba mentés
        save_to_file(telepulesek)
    else:
        print("Nem sikerült adatot kinyerni.")