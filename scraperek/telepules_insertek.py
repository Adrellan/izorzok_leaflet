import time
import re
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError

# --- 1. Adatok és Konfiguráció ---

# A scraping-ből kapott, de tisztításra szoruló településlista
RAW_TELEPULESEK = """
Abasár
Ajak
Aldebrő
Algyő
Almásfüzitő
Álmosd
Alsógalla
Alsómocsolád
Andocs
Apátfalva
Ásotthalom
Átány
Badacsonytomaj
Bajna
Bakonynána
Balatonakali
Balatonberény
Balatonboglár
Balatonendréd
Balatonkiliti
Balatonlelle
Balatonudvari
Bálványos
Bár
Bárdudvarnok
Báta
Bátor
Bátya
Békésszentandrás
Bercel
Berente
Berettyóújfalu
Bezenye
Bölcske
Boldog
Bucsuta
Budajenő
Bugyi
Buzsák
Ceglédbercel
Csajág
Csákvár
Csanádpalota
Császártöltés
Csemő
Cserépfalu
Csernely
Csókakő
Csolnok
Csólyospálos
Csömör
Csór
Csurgó
Dánszentmiklós
Darnózseli
Darnózseli – Böjt
Deszk
Domoszló
Dozmat
Drávaszabolcs
Dunabogdány
Dunaegyháza
Dunakömlőd
Dunavecse
Dusnok
Ecseny
Egerszalók
Egervár
Erdőtarcsa
Érsekcsanád
Erzsébet
Farkasdomb – Szilveszter és újév
Farmos
Fegyvernek
Fehérvárcsurgó
Feked
Felsőnyék
Foktő
Füle
Fülöp
Galgahévíz
Gara
Gátér
Gávavencsellő
Geresdlak
Gesztely-Újharangod
Gölle
Gomba
Görgeteg
Gyenesdiás
Gyomaendrőd
Gyöngyöspata
Gyöngyössolymos
Gyöngyöstarján
Györköny
Győrújfalu
Győrzámoly
Gyulafirátót
Hajdúhadház
Hajós
Halimba
Háromfa
Harta
Hedrehely
Hegykő
Herencsény
Herend
Hévíz
Hidas
Homokmégy
Hosszúhetény
Igal
Iharosberény
Iszkaszentgyörgy
Jakabszállás
Jenő
Kács
Kadarkút
Kakasd
Kakucs
Kalaznó
Kállósemjén
Kaposújlak
Karád
Karád – Augusztus 20.
Karancslapujtő
Karcag
Kátoly
Káva
Kávás
Kékesd
Kelebia
Kerekegyháza
Kesztölc
Kétbodony
Kéthely
Kisapáti
Kisbajom
Kisgyalán
Kisgyőr
Kisgyőr – Karácsony
Kiskunfélegyháza
Kiskunhalas
Kisnána
Kisszékely
Kocs
Kóka
Kölesd-Borjád
Komlóska
Kőröshegy
Körösszakál
Kőszegszerdahely
Kunfehértó
Kunhegyes
Kustánszeg
Lajoskomárom
Látrány
Legénd
Lenti
Létavértes
Lipót
Liptód
Lónya
Lovasberény
Lulla
Madocsa
Maglód
Mágocs
Magyaregregy
Magyarpolány
Magyarszék
Mátraderecske
Mátranovák
Mecseknádasd
Medina
Méhkerék
Mencshely
Mesztegnyő
Mezőberény
Mezőberény – Farsang
Mezőfalva
Mezőkomárom
Mezőkovácsháza
Mezőszentgyörgy
Mezőszilas
Mezőtárkány
Miklósi
Mikóháza
Milota
Miske
Monostorapáti
Mosdós
Mözs
Nádasd
Nagybajom
Nagybörzsöny
Nagydobos
Nagydorog
Nagyhajmás
Nagyhegyes
Nagykörű
Nagymágocs
Nagymányok
Nagyrábé
Nagyrada
Nagyrécse
Nagyszakácsi
Nagytevel
Nagyvázsony
Nekézseny
Nekézseny – Húsvét
Nemescsó
Nemesnádudvar
Németkér
Nézsa
Nikla
Noszvaj
Nyárlőrinc
Nyíregyháza
Nyírmártonfalva
Óbánya
Ócsa
Őcsény
Olaszfalu
Orfű
Örményes
Őrség
Öskü
Ostffyasszonyfa
Oszkó
Öttömös
Ozora
Palotabozsok
Pánd
Pátka
Páty
Pázmánd
Penyige
Péteri
Petőmihályfa
Pincehely
Pócsmegyer
Porrogszentkirály
Porva
Pusztamérges
Pusztavám
Rácalmás
Rátka
Regöly
Révfülöp
Rezi
Rimóc
Ságvár
Sándorfalva
Sáregres
Sárpilis
Sárszentlőrinc
Seregélyes
Siklós
Simontornya
Sióagárd
Siófok
Siójut
Soltvadkert
Somberek
Somodor
Somogyszentpál
Somogyszob
Somogytúr
Somogyvár
Sülysáp
Súr
Szalafő
Szany
Szászvár
Szatmárcseke
Szatta
Szenna
Szentendre
Szentgál
Szentkirály
Szepetnek
Szigetbecse
Szigliget
Sződliget
Szólád
Szomolya
Szulok
Szurdokpüspöki
Táborfalva
Tác
Taktaszada
Tápióbicske
Tápióság
Tápiószentmárton
Tápiószőlős
Tard
Tard – Advent
Tarhos
Tengelic
Tényő
Tevel
Tihany
Tiszakécske
Tiszakürt
Tiszapüspöki
Tóalmás
Tolcsva
Törtel
Tótkomlós
Tótszerdahely
Tura
Túrkeve
Úrhida
Úrkút
Vanyarc
Varsány
Varsány – Pünkösd
Vecsés
Velem
Verőce
Verpelét
Vitnyéd
Zákányszék
Zalaegerszeg
Zalamerenye
Zánka
Zebegény
Zengővárkony
Zsáka
"""

# Vármegye ID leképezés (Vármegye név -> ID)
REGION_MAPPING = {
    "Tolna vármegye": 1,
    "Bács-Kiskun vármegye": 2,
    "Fejér vármegye": 3,
    "Komárom-Esztergom vármegye": 4,
    "Budapest": 5,
    "Pest vármegye": 6,
    "Csongrád-Csanád vármegye": 7,
    "Békés vármegye": 8,
    "Jász-Nagykun-Szolnok vármegye": 9,
    "Heves vármegye": 10,
    "Hajdú-Bihar vármegye": 11,
    "Nógrád vármegye": 12,
    "Borsod-Abaúj-Zemplén vármegye": 13,
    "Szabolcs-Szatmár-Bereg vármegye": 14,
    "Vas vármegye": 15,
    "Baranya vármegye": 16,
    "Zala vármegye": 17,
    "Somogy vármegye": 18,
    "Győr-Moson-Sopron vármegye": 19,
    "Veszprém vármegye": 20,
}

# Geokódoló inicializálása
geolocator = Nominatim(user_agent="izorzok_settlement_scraper_v1")

# --- 2. Segédfüggvények ---

def get_region_id(county_name):
    """Visszaadja a vármegye ID-t a nevéből, ellenőrizve az alternatív neveket is."""
    # A Nominatim néha "Megye"-ként, néha "Vármegye"-ként adja vissza.
    county_name = county_name.replace(" megye", " vármegye")
    return REGION_MAPPING.get(county_name, 'NULL')

def geocode_settlement(settlement_name, country="Hungary"):
    """Megkeresi a település koordinátáit és vármegye nevét."""
    query = f"{settlement_name}, {country}"
    
    try:
        location = geolocator.geocode(query, addressdetails=True, timeout=10)
        
        if location:
            lat = location.latitude
            lon = location.longitude
            
            # Próbáljuk meg kinyerni a vármegye nevét a Nominatim válaszból
            county_name = None
            if location.raw and 'address' in location.raw:
                address = location.raw['address']
                
                # Lehetséges mezők a vármegye nevére
                if 'county' in address:
                    county_name = address['county']
                elif 'state' in address:
                    county_name = address['state']
            
            return lat, lon, county_name
        
    except GeocoderTimedOut:
        print(f"  ❌ Hiba: Időtúllépés a(z) {settlement_name} geokódolásánál.")
    except GeocoderServiceError as e:
        print(f"  ❌ Hiba: Szolgáltatási hiba a(z) {settlement_name} geokódolásánál: {e}")
    
    return None, None, None

def clean_settlement_name(raw_name):
    """Kitisztítja a településnevet a szokatlan részekből."""
    # Eltávolítja a " – Valami" részeket (pl. " – Karácsony")
    name = re.sub(r' – .*$', '', raw_name).strip()
    # Eltávolítja a " – Böjt" és hasonlókat
    name = re.sub(r' - .*$', '', name).strip()
    return name

# --- 3. Fő Logika ---

def generate_sql_inserts(raw_data):
    """
    Feldolgozza a nyers listát, geokódolja a településeket, 
    és létrehozza a PostGIS INSERT parancsokat.
    """
    cleaned_names = [clean_settlement_name(n) for n in raw_data.strip().split('\n') if n.strip()]
    sql_statements = []
    
    print(f"Indítás: {len(cleaned_names)} település feldolgozása.\n")
    
    for i, original_name in enumerate(cleaned_names):
        print(f"[{i+1}/{len(cleaned_names)}] Feldolgozás: {original_name}...")
        
        # 1. Geokódolás
        lat, lon, county_name = geocode_settlement(original_name)
        
        if lat is None:
            print(f"  ❌ Kihagyva: Nincs találat vagy hiba a(z) {original_name} esetén.")
            region_id = 'NULL'
            geom_value = 'NULL'
        else:
            # 2. Vármegye ID lekérése
            region_id = get_region_id(county_name) if county_name else 'NULL'
            
            # 3. PostGIS geometria (POINT) létrehozása
            geom_value = f"ST_SetSRID(ST_MakePoint({lon:.4f}, {lat:.4f}), 4326)"
            
            print(f"  ✅ Találat: Lat/Lon: {lat:.4f}/{lon:.4f}, Vármegye: {county_name} (ID: {region_id})")

        # 4. SQL INSERT parancs összeállítása
        # Biztosítjuk, hogy a name oszlopba a tisztított név kerüljön
        sql = f"INSERT INTO public.\"Settlement\" (id, name, regionid, geom) VALUES ({i+1}, '{original_name.replace("'", "''")}', {region_id}, {geom_value});"
        sql_statements.append(sql)
        
        # Késleltetés a Nominatim szabályainak betartása érdekében
        time.sleep(1.0)
        
    return sql_statements

# --- 4. Futtatás és Fájlba Mentés ---

if __name__ == '__main__':
    SQL_FILE = "settlement_inserts.sql"
    
    # 1. SQL parancsok generálása
    sql_results = generate_sql_inserts(RAW_TELEPULESEK)

    # 2. Fájlba mentés
    try:
        with open(SQL_FILE, 'w', encoding='utf-8') as f:
            f.write("--- Ízőrzők települések adatai (generálva Python szkripttel) ---\n\n")
            f.write("--- MEGJEGYZÉS: Ellenőrizze a regionid oszlopokat (NULL értékek) és a vármegyeneveket!\n\n")
            f.write('\n'.join(sql_results))
        
        print(f"\n\n✅ Sikeresen generálva és elmentve a(z) '{SQL_FILE}' fájlba.")
        print(f"A futtatás előtt ellenőrizze az SQL fájlt, főleg a NULL regionid értékeket!")
        
    except IOError as e:
        print(f"Hiba a fájlba írás során: {e}")