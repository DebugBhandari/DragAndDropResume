import { LocaleCode } from '@/types/resume';

type UiText = {
  appTitle: string;
  edit: string;
  exportPdf: string;
  editor: string;
  close: string;
  settings: string;
  sections: string;
  introduction: string;
  photo: string;
  addToResume: string;
  language: string;
  chooseLanguageProfile: string;
  layout: string;
  style: string;
  showIconOnResume: string;
  dropSectionsHere: string;
  tipDragSections: string;
  layoutClassic: string;
  layoutModern: string;
  layoutCompact: string;
  layoutTwoColumn: string;
  sidebarWidth: string;
  narrow: string;
  wide: string;
  styleIcons: string;
  styleHeader: string;
  styleBody: string;
  styleAccentColor: string;
  styleSidebarColor: string;
  styleFontSize: string;
  styleHeaderAlignment: string;
  styleHeadingSize: string;
  styleSectionSpacing: string;
  styleFont: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  feedbackButton: string;
  feedbackContact: string;
  feedbackSendTitle: string;
  feedbackSubtitle: string;
  feedbackName: string;
  feedbackEmail: string;
  feedbackMessage: string;
  feedbackCancel: string;
  feedbackSend: string;
  feedbackSending: string;
  feedbackSuccess: string;
  feedbackError: string;
  openFeedbackAria: string;
  closeFeedbackAria: string;
};

const UI_TEXT: Record<LocaleCode, UiText> = {
  en: {
    appTitle: 'Easy Resume',
    edit: 'Edit',
    exportPdf: 'Export PDF',
    editor: 'Editor',
    close: 'Close',
    settings: 'Settings',
    sections: 'Sections',
    introduction: 'Introduction',
    photo: 'Photo',
    addToResume: 'Add to resume',
    language: 'Language',
    chooseLanguageProfile: 'Choose the resume language profile.',
    layout: 'Layout',
    style: 'Style',
    showIconOnResume: 'Show icon on resume',
    dropSectionsHere: 'Drop sections here',
    tipDragSections: 'Tip: drag sections to reorder them, and drag the photo in the header to position it.',
    layoutClassic: 'Classic',
    layoutModern: 'Modern',
    layoutCompact: 'Compact',
    layoutTwoColumn: 'Two Column',
    sidebarWidth: 'Sidebar Width',
    narrow: 'Narrow',
    wide: 'Wide',
    styleIcons: 'Icons',
    styleHeader: 'Header',
    styleBody: 'Body',
    styleAccentColor: 'Accent Color',
    styleSidebarColor: 'Sidebar Color',
    styleFontSize: 'Font Size',
    styleHeaderAlignment: 'Header Alignment',
    styleHeadingSize: 'Heading Size',
    styleSectionSpacing: 'Section Spacing',
    styleFont: 'Font',
    alignLeft: 'Left',
    alignCenter: 'Center',
    alignRight: 'Right',
    feedbackButton: 'Feedback',
    feedbackContact: 'Contact',
    feedbackSendTitle: 'Send Feedback',
    feedbackSubtitle: 'Share suggestions, bug reports, or product thoughts.',
    feedbackName: 'Name',
    feedbackEmail: 'Email',
    feedbackMessage: 'Message',
    feedbackCancel: 'Cancel',
    feedbackSend: 'Send',
    feedbackSending: 'Sending...',
    feedbackSuccess: 'Thanks. Your feedback has been sent.',
    feedbackError: 'Unable to send feedback right now.',
    openFeedbackAria: 'Open feedback form',
    closeFeedbackAria: 'Close feedback form',
  },
  fi: {
    appTitle: 'Helppo CV', edit: 'Muokkaa', exportPdf: 'Vie PDF', editor: 'Muokkain', close: 'Sulje',
    settings: 'Asetukset', sections: 'Osiot', introduction: 'Johdanto', photo: 'Kuva', addToResume: 'Lisaa CV:hen',
    language: 'Kieli', chooseLanguageProfile: 'Valitse CV-profiilin kieli.', layout: 'Asettelu', style: 'Tyyli',
    showIconOnResume: 'Nayta kuvake CV:ssa', dropSectionsHere: 'Pudota osiot tahan',
    tipDragSections: 'Vinkki: jarjesta osiot vetamalla ja siirra kuvaa otsikossa vetamalla.',
    layoutClassic: 'Klassinen', layoutModern: 'Moderni', layoutCompact: 'Tiivis', layoutTwoColumn: 'Kaksi saraketta',
    sidebarWidth: 'Sivupalkin leveys', narrow: 'Kapea', wide: 'Levea', styleIcons: 'Kuvakkeet',
    styleHeader: 'Otsikko', styleBody: 'Sisalto', styleAccentColor: 'Korostusvari', styleSidebarColor: 'Sivupalkin vari', styleFontSize: 'Fonttikoko',
    styleHeaderAlignment: 'Otsikon tasaus', styleHeadingSize: 'Otsikon koko', styleSectionSpacing: 'Osioiden valit',
    styleFont: 'Fontti', alignLeft: 'Vasen', alignCenter: 'Keskella', alignRight: 'Oikea',
    feedbackButton: 'Palaute', feedbackContact: 'Yhteys', feedbackSendTitle: 'Laheta palaute',
    feedbackSubtitle: 'Jaa ehdotuksia, bugiraportteja tai ajatuksia tuotteesta.', feedbackName: 'Nimi',
    feedbackEmail: 'Sahkoposti', feedbackMessage: 'Viesti', feedbackCancel: 'Peruuta', feedbackSend: 'Laheta',
    feedbackSending: 'Lahetetaan...', feedbackSuccess: 'Kiitos. Palautteesi on lahetetty.',
    feedbackError: 'Palautetta ei voitu lahettaa juuri nyt.', openFeedbackAria: 'Avaa palautelomake',
    closeFeedbackAria: 'Sulje palautelomake',
  },
  sv: {
    appTitle: 'Enkel CV', edit: 'Redigera', exportPdf: 'Exportera PDF', editor: 'Editor', close: 'Stang',
    settings: 'Installningar', sections: 'Sektioner', introduction: 'Introduktion', photo: 'Foto', addToResume: 'Lagg till i CV',
    language: 'Sprak', chooseLanguageProfile: 'Valj sprakprofil for CV.', layout: 'Layout', style: 'Stil',
    showIconOnResume: 'Visa ikon i CV', dropSectionsHere: 'Slapp sektioner har',
    tipDragSections: 'Tips: dra sektioner for att ordna om dem, och dra bilden i sidhuvudet for att placera den.',
    layoutClassic: 'Klassisk', layoutModern: 'Modern', layoutCompact: 'Kompakt', layoutTwoColumn: 'Tva kolumner',
    sidebarWidth: 'Sidopanelens bredd', narrow: 'Smal', wide: 'Bred', styleIcons: 'Ikoner', styleHeader: 'Rubrik',
    styleBody: 'Innehall', styleAccentColor: 'Accentfarg', styleSidebarColor: 'Sidofarg', styleFontSize: 'Teckenstorlek',
    styleHeaderAlignment: 'Rubrikjustering', styleHeadingSize: 'Rubrikstorlek', styleSectionSpacing: 'Sektionsavstand',
    styleFont: 'Typsnitt', alignLeft: 'Vanster', alignCenter: 'Centrera', alignRight: 'Hoger',
    feedbackButton: 'Feedback', feedbackContact: 'Kontakt', feedbackSendTitle: 'Skicka feedback',
    feedbackSubtitle: 'Dela forslag, felrapporter eller produkttankar.', feedbackName: 'Namn',
    feedbackEmail: 'E-post', feedbackMessage: 'Meddelande', feedbackCancel: 'Avbryt', feedbackSend: 'Skicka',
    feedbackSending: 'Skickar...', feedbackSuccess: 'Tack. Din feedback har skickats.',
    feedbackError: 'Det gick inte att skicka feedback just nu.', openFeedbackAria: 'Oppna feedbackformular',
    closeFeedbackAria: 'Stang feedbackformular',
  },
  es: {
    appTitle: 'CV Facil', edit: 'Editar', exportPdf: 'Exportar PDF', editor: 'Editor', close: 'Cerrar',
    settings: 'Configuracion', sections: 'Secciones', introduction: 'Introduccion', photo: 'Foto', addToResume: 'Agregar al CV',
    language: 'Idioma', chooseLanguageProfile: 'Elige el idioma del perfil del CV.', layout: 'Diseno', style: 'Estilo',
    showIconOnResume: 'Mostrar icono en CV', dropSectionsHere: 'Suelta secciones aqui',
    tipDragSections: 'Consejo: arrastra secciones para ordenar y arrastra la foto en el encabezado para moverla.',
    layoutClassic: 'Clasico', layoutModern: 'Moderno', layoutCompact: 'Compacto', layoutTwoColumn: 'Dos columnas',
    sidebarWidth: 'Ancho lateral', narrow: 'Estrecho', wide: 'Ancho', styleIcons: 'Iconos', styleHeader: 'Encabezado',
    styleBody: 'Cuerpo', styleAccentColor: 'Color de acento', styleSidebarColor: 'Color lateral', styleFontSize: 'Tamano de fuente',
    styleHeaderAlignment: 'Alineacion del encabezado', styleHeadingSize: 'Tamano de titulos',
    styleSectionSpacing: 'Espaciado de secciones', styleFont: 'Fuente', alignLeft: 'Izquierda',
    alignCenter: 'Centro', alignRight: 'Derecha', feedbackButton: 'Comentarios', feedbackContact: 'Contacto',
    feedbackSendTitle: 'Enviar comentarios', feedbackSubtitle: 'Comparte sugerencias, errores o ideas del producto.',
    feedbackName: 'Nombre', feedbackEmail: 'Correo', feedbackMessage: 'Mensaje', feedbackCancel: 'Cancelar',
    feedbackSend: 'Enviar', feedbackSending: 'Enviando...', feedbackSuccess: 'Gracias. Tu comentario fue enviado.',
    feedbackError: 'No se pudo enviar el comentario en este momento.', openFeedbackAria: 'Abrir formulario de comentarios',
    closeFeedbackAria: 'Cerrar formulario de comentarios',
  },
  de: {
    appTitle: 'Einfacher Lebenslauf', edit: 'Bearbeiten', exportPdf: 'PDF exportieren', editor: 'Editor', close: 'Schliessen',
    settings: 'Einstellungen', sections: 'Abschnitte', introduction: 'Einleitung', photo: 'Foto', addToResume: 'Zum Lebenslauf hinzufugen',
    language: 'Sprache', chooseLanguageProfile: 'Waehle die Sprache des Lebenslauf-Profils.', layout: 'Layout', style: 'Stil',
    showIconOnResume: 'Symbol im Lebenslauf anzeigen', dropSectionsHere: 'Abschnitte hier ablegen',
    tipDragSections: 'Tipp: Abschnitte per Drag-and-Drop sortieren und das Foto im Kopfbereich verschieben.',
    layoutClassic: 'Klassisch', layoutModern: 'Modern', layoutCompact: 'Kompakt', layoutTwoColumn: 'Zweispaltig',
    sidebarWidth: 'Seitenleistenbreite', narrow: 'Schmal', wide: 'Breit', styleIcons: 'Symbole', styleHeader: 'Kopfzeile',
    styleBody: 'Inhalt', styleAccentColor: 'Akzentfarbe', styleSidebarColor: 'Seitenleistenfarbe', styleFontSize: 'Schriftgroesse',
    styleHeaderAlignment: 'Ausrichtung der Kopfzeile', styleHeadingSize: 'Ueberschriftgroesse',
    styleSectionSpacing: 'Abschnittsabstand', styleFont: 'Schriftart', alignLeft: 'Links', alignCenter: 'Mitte', alignRight: 'Rechts',
    feedbackButton: 'Feedback', feedbackContact: 'Kontakt', feedbackSendTitle: 'Feedback senden',
    feedbackSubtitle: 'Teile Vorschlaege, Fehlerberichte oder Produktideen.', feedbackName: 'Name',
    feedbackEmail: 'E-Mail', feedbackMessage: 'Nachricht', feedbackCancel: 'Abbrechen', feedbackSend: 'Senden',
    feedbackSending: 'Wird gesendet...', feedbackSuccess: 'Danke. Dein Feedback wurde gesendet.',
    feedbackError: 'Feedback konnte gerade nicht gesendet werden.', openFeedbackAria: 'Feedback-Formular oeffnen',
    closeFeedbackAria: 'Feedback-Formular schliessen',
  },
  fr: {
    appTitle: 'CV Facile', edit: 'Modifier', exportPdf: 'Exporter PDF', editor: 'Editeur', close: 'Fermer',
    settings: 'Parametres', sections: 'Sections', introduction: 'Introduction', photo: 'Photo', addToResume: 'Ajouter au CV',
    language: 'Langue', chooseLanguageProfile: 'Choisissez la langue du profil CV.', layout: 'Mise en page', style: 'Style',
    showIconOnResume: 'Afficher l icone sur le CV', dropSectionsHere: 'Deposez les sections ici',
    tipDragSections: 'Astuce : faites glisser les sections pour reordonner et la photo dans l en-tete pour la placer.',
    layoutClassic: 'Classique', layoutModern: 'Moderne', layoutCompact: 'Compact', layoutTwoColumn: 'Deux colonnes',
    sidebarWidth: 'Largeur de la barre laterale', narrow: 'Etroit', wide: 'Large', styleIcons: 'Icones', styleHeader: 'En-tete',
    styleBody: 'Corps', styleAccentColor: 'Couleur d accent', styleSidebarColor: 'Couleur laterale', styleFontSize: 'Taille de police',
    styleHeaderAlignment: 'Alignement de l en-tete', styleHeadingSize: 'Taille des titres',
    styleSectionSpacing: 'Espacement des sections', styleFont: 'Police', alignLeft: 'Gauche', alignCenter: 'Centre',
    alignRight: 'Droite', feedbackButton: 'Retour', feedbackContact: 'Contact', feedbackSendTitle: 'Envoyer un retour',
    feedbackSubtitle: 'Partagez des suggestions, des bugs ou des idees produit.', feedbackName: 'Nom',
    feedbackEmail: 'E-mail', feedbackMessage: 'Message', feedbackCancel: 'Annuler', feedbackSend: 'Envoyer',
    feedbackSending: 'Envoi...', feedbackSuccess: 'Merci. Votre retour a ete envoye.',
    feedbackError: 'Impossible d envoyer le retour pour le moment.', openFeedbackAria: 'Ouvrir le formulaire de retour',
    closeFeedbackAria: 'Fermer le formulaire de retour',
  },
  ne: {
    appTitle: 'सजिलो रिज्युमे', edit: 'सम्पादन', exportPdf: 'PDF निर्यात', editor: 'सम्पादक', close: 'बन्द गर्नुहोस्',
    settings: 'सेटिङ्स', sections: 'सेक्सनहरू', introduction: 'परिचय', photo: 'फोटो', addToResume: 'रिज्युमेमा थप्नुहोस्',
    language: 'भाषा', chooseLanguageProfile: 'रिज्युमे भाषाको प्रोफाइल चयन गर्नुहोस्।', layout: 'लेआउट', style: 'शैली',
    showIconOnResume: 'रिज्युमेमा आइकन देखाउनुहोस्', dropSectionsHere: 'यहाँ सेक्सनहरू छोड्नुहोस्',
    tipDragSections: 'सुझाव: सेक्सनहरू क्रम मिलाउन तान्नुहोस्, र हेडरको फोटो स्थान मिलाउन तान्नुहोस्।',
    layoutClassic: 'क्लासिक', layoutModern: 'आधुनिक', layoutCompact: 'कम्प्याक्ट', layoutTwoColumn: 'दुई स्तम्भ',
    sidebarWidth: 'साइडबार चौडाइ', narrow: 'साँघुरो', wide: 'फराकिलो', styleIcons: 'आइकनहरू', styleHeader: 'हेडर', styleBody: 'बडी',
    styleAccentColor: 'मुख्य रङ', styleSidebarColor: 'साइडबार रङ', styleFontSize: 'फन्ट साइज', styleHeaderAlignment: 'हेडर मिलान',
    styleHeadingSize: 'हेडिङ साइज', styleSectionSpacing: 'सेक्सन दूरी', styleFont: 'फन्ट',
    alignLeft: 'बायाँ', alignCenter: 'बीच', alignRight: 'दायाँ', feedbackButton: 'प्रतिक्रिया', feedbackContact: 'सम्पर्क',
    feedbackSendTitle: 'प्रतिक्रिया पठाउनुहोस्', feedbackSubtitle: 'सुझाव, बग रिपोर्ट वा उत्पादन सम्बन्धी विचार साझा गर्नुहोस्।',
    feedbackName: 'नाम', feedbackEmail: 'इमेल', feedbackMessage: 'सन्देश', feedbackCancel: 'रद्द गर्नुहोस्', feedbackSend: 'पठाउनुहोस्',
    feedbackSending: 'पठाउँदै...', feedbackSuccess: 'धन्यवाद। तपाईंको प्रतिक्रिया पठाइयो।',
    feedbackError: 'अहिले प्रतिक्रिया पठाउन सकिएन।', openFeedbackAria: 'प्रतिक्रिया फारम खोल्नुहोस्',
    closeFeedbackAria: 'प्रतिक्रिया फारम बन्द गर्नुहोस्',
  },
  zh: {
    appTitle: '简历编辑', edit: '编辑', exportPdf: '导出 PDF', editor: '编辑器', close: '关闭',
    settings: '设置', sections: '版块', introduction: '介绍', photo: '照片', addToResume: '添加到简历', language: '语言',
    chooseLanguageProfile: '选择简历语言配置。', layout: '布局', style: '样式', showIconOnResume: '在简历中显示图标',
    dropSectionsHere: '将模块拖到这里', tipDragSections: '提示：拖动模块排序，也可拖动头像调整位置。',
    layoutClassic: '经典', layoutModern: '现代', layoutCompact: '紧凑', layoutTwoColumn: '双栏',
    sidebarWidth: '侧边栏宽度', narrow: '窄', wide: '宽', styleIcons: '图标', styleHeader: '页眉', styleBody: '正文',
    styleAccentColor: '主题色', styleSidebarColor: '侧栏颜色', styleFontSize: '字体大小', styleHeaderAlignment: '页眉对齐', styleHeadingSize: '标题大小',
    styleSectionSpacing: '模块间距', styleFont: '字体', alignLeft: '左', alignCenter: '中', alignRight: '右',
    feedbackButton: '反馈', feedbackContact: '联系', feedbackSendTitle: '发送反馈',
    feedbackSubtitle: '分享建议、问题报告或产品想法。', feedbackName: '姓名', feedbackEmail: '邮箱',
    feedbackMessage: '留言', feedbackCancel: '取消', feedbackSend: '发送', feedbackSending: '发送中...',
    feedbackSuccess: '谢谢，反馈已发送。', feedbackError: '当前无法发送反馈。',
    openFeedbackAria: '打开反馈表单', closeFeedbackAria: '关闭反馈表单',
  },
  ja: {
    appTitle: '履歴書エディタ', edit: '編集', exportPdf: 'PDFをエクスポート', editor: 'エディタ', close: '閉じる',
    settings: '設定', sections: 'セクション', introduction: '紹介', photo: '写真', addToResume: '履歴書に追加', language: '言語',
    chooseLanguageProfile: '履歴書の言語プロファイルを選択してください。', layout: 'レイアウト', style: 'スタイル',
    showIconOnResume: '履歴書にアイコンを表示', dropSectionsHere: 'ここにセクションをドロップ',
    tipDragSections: 'ヒント: セクションをドラッグして並べ替え、ヘッダーの写真もドラッグで位置調整できます。',
    layoutClassic: 'クラシック', layoutModern: 'モダン', layoutCompact: 'コンパクト', layoutTwoColumn: '2カラム',
    sidebarWidth: 'サイドバー幅', narrow: '狭い', wide: '広い', styleIcons: 'アイコン', styleHeader: 'ヘッダー', styleBody: '本文',
    styleAccentColor: 'アクセントカラー', styleSidebarColor: 'サイドバー色', styleFontSize: 'フォントサイズ', styleHeaderAlignment: 'ヘッダーの配置',
    styleHeadingSize: '見出しサイズ', styleSectionSpacing: 'セクション間隔', styleFont: 'フォント',
    alignLeft: '左', alignCenter: '中央', alignRight: '右', feedbackButton: 'フィードバック', feedbackContact: '連絡',
    feedbackSendTitle: 'フィードバックを送信', feedbackSubtitle: '提案、バグ報告、または製品への意見をお寄せください。',
    feedbackName: '名前', feedbackEmail: 'メール', feedbackMessage: 'メッセージ', feedbackCancel: 'キャンセル', feedbackSend: '送信',
    feedbackSending: '送信中...', feedbackSuccess: 'ありがとうございます。フィードバックを送信しました。',
    feedbackError: '現在、フィードバックを送信できません。', openFeedbackAria: 'フィードバックフォームを開く',
    closeFeedbackAria: 'フィードバックフォームを閉じる',
  },
};

export function getUiText(locale: LocaleCode): UiText {
  return UI_TEXT[locale] ?? UI_TEXT.en;
}
