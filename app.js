// --- 1. CONFIGURATION FIREBASE ---
// Importation des outils Firebase depuis les serveurs officiels
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ⚠️ REMPLACE CET OBJET PAR CELUI FOURNI PAR FIREBASE DANS TON PROJET ⚠️
const firebaseConfig = {
  apiKey: "AIzaSyAC38RWHlHMpD5Zehu7yy-l6kyhaGbHw7M",
  authDomain: "organisationconcerts.firebaseapp.com",
  projectId: "organisationconcerts",
  storageBucket: "organisationconcerts.firebasestorage.app",
  messagingSenderId: "657586450754",
  appId: "1:657586450754:web:a92c201c9ecc9ad352d8db",
  measurementId: "G-853E68N9XK"
};

// Initialisation de la base de données
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- 2. ÉTAT DE L'APPLICATION ---
let repertoire = [];
let concert = [];
let indexDeplace = null;
let listeOrigine = null;

// --- 3. CONNEXION À LA BASE DE DONNÉES ---

// Sauvegarde l'état complet des deux listes
async function sauvegarderDonnees() {
  try {
    // On écrit dans une collection "app_musique", dans un document "mes_listes"
    await setDoc(doc(db, "app_musique", "mes_listes"), {
      repertoire: repertoire,
      concert: concert
    });
    console.log("Sauvegarde réussie !");
  } catch (error) {
    console.error("Erreur de sauvegarde :", error);
  }
}

// Charge les listes au démarrage
async function chargerDonnees() {
  try {
    const docSnap = await getDoc(doc(db, "app_musique", "mes_listes"));
    if (docSnap.exists()) {
      const data = docSnap.data();
      repertoire = data.repertoire || [];
      concert = data.concert || [];
      mettreAJourAffichage(); // Met à jour l'écran avec les données téléchargées
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

  // 1. On crée un élément 'strong' (gras) pour les infos principales
  const partieGras = document.createElement('strong');
  let texteInfos = `${chanson.titre} - ${chanson.artiste}`;
  if (chanson.chanteur) texteInfos += ` | ${chanson.chanteur}`;
  if (chanson.accordage) texteInfos += ` [${chanson.accordage}]`;
  texteInfos += ` (${formaterDuree(chanson.duree)})`;
  
  partieGras.textContent = texteInfos;
  spanTexte.appendChild(partieGras); // On injecte la partie en gras

  // 2. Ajout du commentaire s'il existe (en texte normal)
  if (chanson.commentaire) {
    // createTextNode permet d'ajouter du texte brut à la suite
    const texteNote = document.createTextNode(`\nNote : ${chanson.commentaire}`);
    spanTexte.appendChild(texteNote);
  }

  // Conteneur pour grouper les boutons (Commentaire + Supprimer)
  const divActions = document.createElement('div');
  divActions.classList.add('actions-container');

  // --- BOUTON COMMENTAIRE ---
  const btnCommentaire = document.createElement('button');
  btnCommentaire.textContent = '📃';
  btnCommentaire.classList.add('btn-commentaire');
  btnCommentaire.title = 'Ajouter ou modifier une note';

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

  // --- BOUTON SUPPRIMER ---
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

  // Assemblage
  divActions.appendChild(btnCommentaire);
  divActions.appendChild(btnSuppr);
  li.appendChild(spanTexte);
  li.appendChild(divActions);

  // Drag & Drop
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

// Calcule l'index exact où insérer la musique en fonction de la position Y de la souris
function obtenirIndexInsertion(ulElement, positionY) {
  // On récupère toutes les chansons de la liste, SAUF celle qu'on est en train de glisser
  const elements = [...ulElement.querySelectorAll('li:not(.dragging)')];

  const resultat = elements.reduce((lePlusProche, enfant, index) => {
    const boite = enfant.getBoundingClientRect();
    // On calcule la distance entre la souris et le milieu de la chanson survolée
    const decalage = positionY - boite.top - boite.height / 2;

    // Si la souris est au-dessus du milieu de l'élément
    if (decalage < 0 && decalage > lePlusProche.decalage) {
      return { decalage: decalage, index: index };
    } else {
      return lePlusProche;
    }
  }, { decalage: Number.NEGATIVE_INFINITY, index: elements.length });

  return resultat.index; // Retourne l'index exact où on doit insérer
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

    // On calcule la position visée
    const indexInsertion = obtenirIndexInsertion(ulElement, e.clientY);

    // 1. On retire l'élément de sa liste de départ
    const [chansonDeplacee] = tableauSource.splice(indexDeplace, 1);
    
    // 2. On l'insère dans la liste d'arrivée à l'index calculé
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

// --- 7. AJOUT DE CHANSON ---
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

  // On enregistre les nouvelles propriétés
  repertoire.push({
    titre: nom,
    artiste: artiste,
    chanteur: chanteur,
    accordage: accordage,
    duree: dureeSec
  });

  // Réinitialisation des champs
  nomInput.value = '';
  artisteInput.value = '';
  singerInput.value = '';
  tuningInput.value = '';
  dureeInput.value = '';

  mettreAJourAffichage();
  sauvegarderDonnees();
}

function toutRenvoyerAuRepertoire() {
  // Si le concert est déjà vide, inutile d'exécuter la suite
  if (concert.length === 0) return;

  // On ajoute toutes les chansons du concert dans le répertoire
  repertoire.push(...concert);

  // On vide complètement le tableau du concert
  concert = [];

  // On met à jour l'affichage et la base Firebase
  mettreAJourAffichage();
  sauvegarderDonnees();
}

function exporterTableurCSV() {
  if (concert.length === 0) {
    alert("La liste du concert est vide ! Rien à exporter.");
    return;
  }

  // En-têtes avec la colonne Commentaire
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

// --- 8. INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
  const btnAjouter = document.getElementById('add-song-button');
  if (btnAjouter) btnAjouter.addEventListener('click', ajouterChanson);

  const ulRepertoire = document.getElementById('repertoire-list');
  const ulConcert = document.getElementById('concert-list');

  if (ulRepertoire) configurerZoneDepot(ulRepertoire, 'repertoire');
  if (ulConcert) configurerZoneDepot(ulConcert, 'concert');

  // Écouteur pour le bouton de transfert
  const btnVider = document.getElementById('clear-concert-btn');
  if (btnVider) btnVider.addEventListener('click', toutRenvoyerAuRepertoire);

  // Écouteur pour le bouton d'export
  const btnExporter = document.getElementById('export-csv-btn');
  if (btnExporter) btnExporter.addEventListener('click', exporterTableurCSV);

  chargerDonnees();
});
