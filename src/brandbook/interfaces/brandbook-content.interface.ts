export interface Typography {
  primaryFont: string;
  secondaryFont: string;
  fontUsageGuidelines: string[];
  [key: string]: string | string[];
}

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  neutral: string[];
  colorUsageGuidelines: string[];
  [key: string]: string | string[];
}

export interface BrandIdentity {
  mission: string;
  vision: string;
  values: string[];
  personality: string[];
  [key: string]: string | string[];
}

export interface LogoGuidelines {
  minimumSize: string;
  clearSpace: string;
  dosDonts: {
    dos: string[];
    donts: string[];
    [key: string]: string[];
  };
  [key: string]:
    | string
    | { dos: string[]; donts: string[]; [key: string]: string[] };
}

export interface VoiceTone {
  characteristics: string[];
  examples: {
    formal: string;
    casual: string;
    [key: string]: string;
  };
  guidelines: string[];
  [key: string]:
    | string[]
    | { formal: string; casual: string; [key: string]: string };
}

export interface BrandbookContent {
  typography: Typography;
  colorPalette: ColorPalette;
  brandIdentity: BrandIdentity;
  logoGuidelines: LogoGuidelines;
  voiceTone: VoiceTone;
  [key: string]:
    | Typography
    | ColorPalette
    | BrandIdentity
    | LogoGuidelines
    | VoiceTone;
}
