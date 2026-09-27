// --- 1. CONFIGURATION FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ⚠️ Ta configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAC38RWHlHMpD5Zehu7yy-l6kyhaGbHw7M",
  authDomain: "organisationconcerts.firebaseapp.com",
  projectId: "organisationconcerts",
  storageBucket: "organisationconcerts.firebasestorage.app",
  messagingSenderId: "657586450754",
  appId: "1:657586450754:web:a92c201c9ecc9ad352d8db",
  measurementId: "G-853E68N9XK"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- 2. ÉTAT DE L'APPLICATION ---
let repertoire = [];
let concert = [];
let indexDeplace = null;
let listeOrigine = null;

// --- 3. CONNEXION À LA BASE DE DONNÉES GLOBALE ---
async function sauvegarderDonnees() {
  try {
    await setDoc(doc(db, "app_musique", "mes_listes"), {
      repertoire: repertoire,
      concert: concert
    });
  } catch (error) {
    console.error("Erreur de sauvegarde :", error);
  }
}

async function chargerDonnees() {
  try {
    const docSnap = await getDoc(doc(db, "app_musique", "mes_listes"));
    if (docSnap.exists()) {
      const data = docSnap.data();
      repertoire = data.repertoire || [];
      concert = data.concert || [];
      mettreAJourAffichage();
    }
  } catch (error) {
    console.error("Erreur de chargement :", error);
  }
}

// --- 4. FONCTIONS UTILITAIRES ---
function formaterDuree(secondesTotales) {
  const min = Math.floor(secondesTotales / 60);
  const sec = secondesTotales % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function analyserDuree(dureeStr) {
  const parties = dureeStr.split(':');
  if (parties.length !== 2) return null;
  const min = parseInt(parties[0], 10);
  const sec = parseInt(parties[1], 10);
  if (isNaN(min) || isNaN(sec) || sec < 0 || sec >= 60 || min < 0) return null;
  return min * 60 + sec;
}

// --- 5. DESSIN DES ÉLÉMENTS ET DRAG & DROP ---
function creerElementChanson(chanson, index, nomListe) {
  const li = document.createElement('li');
  li.draggable = true;

  const spanTexte = document.createElement('span');

  // Partie en gras
  const partieGras = document.createElement('strong');
  let texteInfos = `${chanson.titre} - ${chanson.artiste}`;
  if (chanson.chanteur) texteInfos += ` | Chant : ${chanson.chanteur}`;
  if (chanson.accordage) texteInfos += ` [${chanson.accordage}]`;
  texteInfos += ` (${formaterDuree(chanson.duree)})`;
  
  partieGras.textContent = texteInfos;
  spanTexte.appendChild(partieGras);

  // Partie note (texte normal avec saut de ligne)
  if (chanson.commentaire) {
    const texteNote = document.createTextNode(`\nNote : ${chanson.commentaire}`);
    spanTexte.appendChild(texteNote);
  }

  // Boutons
  const divActions = document.createElement('div');
  divActions.classList.add('actions-container');

  const btnCommentaire = document.createElement('button');
  btnCommentaire.textContent = '📃';
  btnCommentaire.classList.add('btn-commentaire');
  btnCommentaire.title = 'Ajouter/modifier une note';
  btnCommentaire.addEventListener('click', (e) => {
    e.stopPropagation();
    const noteActuelle = chanson.commentaire || '';
    const nouvelleNote = prompt(`Note pour "${chanson.titre}" :`, noteActuelle);
    if (nouvelleNote !== null) {
      const tableauCible = nomListe === 'repertoire' ? repertoire : concert;
      tableauCible[index].commentaire = nouvelleNote.trim();
      mettreAJourAffichage();
      sauvegarderDonnees();
    }
  });

  const btnSuppr = document.createElement('button');
  btnSuppr.textContent = '✕';
  btnSuppr.classList.add('btn-supprimer');
  btnSuppr.title = 'Supprimer cette musique';
  btnSuppr.addEventListener('click', (e) => {
    e.stopPropagation();
    if (nomListe === 'repertoire') {
      repertoire.splice(index, 1);
    } else if (nomListe === 'concert') {
      concert.splice(index, 1);
    }
    mettreAJourAffichage();
    sauvegarderDonnees();
  });

  divActions.appendChild(btnCommentaire);
  divActions.appendChild(btnSuppr);
  li.appendChild(spanTexte);
  li.appendChild(divActions);

  // Événements Drag & Drop
  li.addEventListener('dragstart', (e) => {
    indexDeplace = index;
    listeOrigine = nomListe;
    li.classList.add('dragging');
    e.dataTransfer.setData('text/plain', ''); 
  });

  li.addEventListener('dragend', () => {
    li.classList.remove('dragging');
    indexDeplace = null;
    listeOrigine = null;
  });

  return li;
}

function obtenirIndexInsertion(ulElement, positionY) {
  const elements = [...ulElement.querySelectorAll('li:not(.dragging)')];
  const resultat = elements.reduce((lePlusProche, enfant, index) => {
    const boite = enfant.getBoundingClientRect();
    const decalage = positionY - boite.top - boite.height / 2;
    if (decalage < 0 && decalage > lePlusProche.decalage) {
      return { decalage: decalage, index: index };
    } else {
      return lePlusProche;
    }
  }, { decalage: Number.NEGATIVE_INFINITY, index: elements.length });
  return resultat.index;
}

function configurerZoneDepot(ulElement, nomListeCible) {
  ulElement.addEventListener('dragover', (e) => {
    e.preventDefault(); 
    ulElement.classList.add('drag-over');
  });

  ulElement.addEventListener('dragleave', () => {
    ulElement.classList.remove('drag-over');
  });

  ulElement.addEventListener('drop', (e) => {
    e.preventDefault();
    ulElement.classList.remove('drag-over');

    if (indexDeplace === null || listeOrigine === null) return;

    const tableauSource = listeOrigine === 'repertoire' ? repertoire : concert;
    const tableauCible = nomListeCible === 'repertoire' ? repertoire : concert;

    const indexInsertion = obtenirIndexInsertion(ulElement, e.clientY);
    const [chansonDeplacee] = tableauSource.splice(indexDeplace, 1);
    tableauCible.splice(indexInsertion, 0, chansonDeplacee);

    mettreAJourAffichage();
    sauvegarderDonnees(); 
  });
}

// --- 6. MISE À JOUR DE L'INTERFACE ---
function mettreAJourAffichage() {
  const ulRepertoire = document.getElementById('repertoire-list');
  const ulConcert = document.getElementById('concert-list');
  const totalDureeElem = document.getElementById('total-duree');

  if (ulRepertoire) {
    ulRepertoire.innerHTML = '';
    repertoire.forEach((chanson, index) => {
      ulRepertoire.appendChild(creerElementChanson(chanson, index, 'repertoire'));
    });
  }

  let totalSecondesConcert = 0;
  if (ulConcert) {
    ulConcert.innerHTML = '';
    concert.forEach((chanson, index) => {
      totalSecondesConcert += chanson.duree;
      ulConcert.appendChild(creerElementChanson(chanson, index, 'concert'));
    });
  }

  if (totalDureeElem) {
    totalDureeElem.textContent = `Durée totale du concert : ${formaterDuree(totalSecondesConcert)}`;
  }
}

// --- 7. ACTIONS DES BOUTONS ---
function ajouterChanson() {
  const nomInput = document.getElementById('song-name-input');
  const artisteInput = document.getElementById('artist-input');
  const singerInput = document.getElementById('singer-input');
  const tuningInput = document.getElementById('tuning-input');
  const dureeInput = document.getElementById('duree-input');

  const nom = nomInput.value.trim();
  const artiste = artisteInput.value.trim();
  const chanteur = singerInput.value.trim();
  const accordage = tuningInput.value.trim();
  const dureeStr = dureeInput.value.trim();

  if (!nom || !artiste || !dureeStr) {
    alert('Veuillez remplir au moins le titre, l\'artiste et la durée.');
    return;
  }

  const dureeSec = analyserDuree(dureeStr);
  if (dureeSec === null) {
    alert('Format de durée invalide. Utilisez le format MM:SS (ex: 03:45).');
    return;
  }

  repertoire.push({
    titre: nom,
    artiste: artiste,
    chanteur: chanteur,
    accordage: accordage,
    duree: dureeSec
  });

  nomInput.value = '';
  artisteInput.value = '';
  singerInput.value = '';
  tuningInput.value = '';
  dureeInput.value = '';

  mettreAJourAffichage();
  sauvegarderDonnees();
}

function toutRenvoyerAuRepertoire() {
  if (concert.length === 0) return;
  repertoire.push(...concert);
  concert = [];
  mettreAJourAffichage();
  sauvegarderDonnees();
}

function exporterTableurCSV() {
  if (concert.length === 0) {
    alert("La liste du concert est vide ! Rien à exporter.");
    return;
  }

  let contenuCSV = "Numéro;Titre;Artiste;Chant;Accordage;Durée;Commentaire\n";
  concert.forEach((chanson, index) => {
    const titre = chanson.titre ? chanson.titre.replace(/"/g, '""') : '';
    const artiste = chanson.artiste ? chanson.artiste.replace(/"/g, '""') : '';
    const chanteur = chanson.chanteur ? chanson.chanteur.replace(/"/g, '""') : '';
    const accordage = chanson.accordage ? chanson.accordage.replace(/"/g, '""') : '';
    const duree = formaterDuree(chanson.duree);
    const commentaire = chanson.commentaire ? chanson.commentaire.replace(/"/g, '""') : '';
    contenuCSV += `"${index + 1}";"${titre}";"${artiste}";"${chanteur}";"${accordage}";"${duree}";"${commentaire}"\n`;
  });

  const bom = "\uFEFF"; 
  const blob = new Blob([bom + contenuCSV], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.setAttribute('download', 'Setlist_Concert.csv');
  document.body.appendChild(lien);
  lien.click(); 
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}

// --- 8. SYSTÈME DE SAUVEGARDE DE CONCERTS ---
async function sauvegarderConcertNomme() {
    const nomInput = document.getElementById('nom-concert-input');
    const nom = nomInput.value.trim();

    if (!nom) {
        alert("Veuillez entrer un nom pour ce concert.");
        return;
    }
    if (concert.length === 0) {
        alert("La liste du concert est vide !");
        return;
    }

    try {
        await setDoc(doc(db, "concerts_sauvegardes", nom), {
            chansons: concert
        });
        alert(`Le concert "${nom}" a été sauvegardé !`);
        nomInput.value = ''; 
        chargerListeConcerts(); 
    } catch (error) {
        console.error("Erreur de sauvegarde :", error);
    }
}

async function chargerListeConcerts() {
    const select = document.getElementById('load-concert-select');
    if (!select) return;

    try {
        const querySnapshot = await getDocs(collection(db, "concerts_sauvegardes"));
        select.innerHTML = '<option value="">~ Charger un concert sauvegardé ~</option>';
        
        querySnapshot.forEach((doc) => {
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = doc.id;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Erreur lors du chargement de la liste :", error);
    }
}

async function chargerConcertSpecifique(event) {
    const nomConcert = event.target.value;
    if (!nomConcert) return;

    if (!confirm(`Voulez-vous remplacer le concert actuel par "${nomConcert}" ? \nLes musiques de la colonne de droite retourneront dans le répertoire.`)) {
        event.target.value = ''; 
        return;
    }

    try {
        const docSnap = await getDoc(doc(db, "concerts_sauvegardes", nomConcert));
        if (docSnap.exists()) {
            repertoire.push(...concert);
            
            const nouveauConcert = docSnap.data().chansons || [];
            concert = nouveauConcert;
            
            repertoire = repertoire.filter(chansonRep => {
                return !concert.some(chansonConc => 
                    chansonConc.titre === chansonRep.titre && chansonConc.artiste === chansonRep.artiste
                );
            });

            mettreAJourAffichage();
            sauvegarderDonnees();
            event.target.value = ''; 
        }
    } catch (error) {
        console.error("Erreur de chargement :", error);
    }
}

// --- 9. INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
  const btnAjouter = document.getElementById('add-song-button');
  if (btnAjouter) btnAjouter.addEventListener('click', ajouterChanson);

  const ulRepertoire = document.getElementById('repertoire-list');
  const ulConcert = document.getElementById('concert-list');
  if (ulRepertoire) configurerZoneDepot(ulRepertoire, 'repertoire');
  if (ulConcert) configurerZoneDepot(ulConcert, 'concert');

  const btnVider = document.getElementById('clear-concert-btn');
  if (btnVider) btnVider.addEventListener('click', toutRenvoyerAuRepertoire);

  const btnExporter = document.getElementById('export-csv-btn');
  if (btnExporter) btnExporter.addEventListener('click', exporterTableurCSV);

  const btnSaveNamed = document.getElementById('save-named-concert-btn');
  if (btnSaveNamed) btnSaveNamed.addEventListener('click', sauvegarderConcertNomme);

  const selectLoad = document.getElementById('load-concert-select');
  if (selectLoad) selectLoad.addEventListener('change', chargerConcertSpecifique);

  chargerDonnees();
  chargerListeConcerts();
});