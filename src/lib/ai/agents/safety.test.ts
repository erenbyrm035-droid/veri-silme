import { describe, it, expect } from "vitest";
import { screenUserMessage } from "./safety";

// ============================================================================
// AI koç güvenlik kapısı.
//
// Bu kapı, model çağrılmadan ÖNCE çalışıyor. İki yönlü risk var:
//   - Kaçırılan acil durum: kalp krizi anlatan kullanıcıya antrenman önerisi.
//   - Yanlış pozitif: "dizim ağrıyor" diyen herkesi 112'ye yönlendirmek,
//     uygulamayı kullanılamaz hâle getirir ve gerçek uyarıyı değersizleştirir.
// Bu yüzden testler İKİ yönü de kapsıyor.
// ============================================================================

describe("screenUserMessage — acil durumlar yakalanmalı", () => {
  const acil = [
    "göğsümde şiddetli bir ağrı var",
    "nefes alamıyorum",
    "bayılacağım gibi hissediyorum",
    "başım dönüyor ve gözüm kararıyor",
    "sol kolum uyuşuyor",
    "konuşmam bozuldu, dilim dolaşıyor",
  ];

  for (const m of acil) {
    it(`engeller: "${m}"`, () => {
      const r = screenUserMessage(m);
      expect(r.verdict).toBe("block");
      expect(r.flags.length).toBeGreaterThan(0);
      // Kullanıcı ne yapacağını bilmeli — mesaj acil numarayı içermeli.
      expect(r.message).toContain("112");
    });
  }

  it("kendine zarar niyetinde farklı bir yönlendirme verir", () => {
    const r = screenUserMessage("kendime zarar vermek istiyorum");
    expect(r.verdict).toBe("block");
    expect(r.message).toContain("182");
  });
});

describe("screenUserMessage — sıradan şikâyetler engellenmemeli", () => {
  const normal = [
    "sol dizim zorlanıyor, hangi egzersizi yapayım",
    "bugün kaslarım çok ağrıyor",
    "squat sırasında belim yoruluyor",
    "kardiyoda nefesim daralıyor, kondisyonum düşük",
    "omzum tutuldu, esneme önerir misin",
    "bugün antrenmana çok yorgun başladım",
  ];

  for (const m of normal) {
    it(`geçirir: "${m}"`, () => {
      expect(screenUserMessage(m).verdict).not.toBe("block");
    });
  }
});

describe("screenUserMessage — sınır durumlar", () => {
  it("boş mesajda çökmez", () => {
    expect(screenUserMessage("").verdict).not.toBe("block");
  });

  // Regex'in `i` bayrağı büyük I'yı NOKTALI i'ye indirir; kalıplar ise
  // noktasız ı içeriyor. Caps lock'la yazan kullanıcı tüm güvenlik ağını
  // atlıyordu.
  it("büyük harfle yazılan acil durumu da yakalar", () => {
    expect(screenUserMessage("NEFES ALAMIYORUM").verdict).toBe("block");
    expect(screenUserMessage("GÖĞSÜMDE AĞRI VAR").verdict).toBe("block");
    expect(screenUserMessage("BAYILACAĞIM").verdict).toBe("block");
  });

  it("büyük harf yanlış pozitif üretmez", () => {
    expect(screenUserMessage("BUGÜN KAÇ SET YAPMALIYIM").verdict).not.toBe("block");
  });

  // "göğsümde şiddetli bir ağrı var" klasik kalp krizi tarifi; araya sıfat
  // girdiği için bitişik yazım arayan kalıp bunu kaçırıyordu.
  it("araya kelime giren göğüs ağrısını yakalar", () => {
    expect(screenUserMessage("göğsümde şiddetli bir ağrı var").verdict).toBe("block");
    expect(screenUserMessage("göğsümde bir sıkışma hissediyorum").verdict).toBe("block");
  });

  it("Türkçe klavyesiz yazımı da yakalar", () => {
    expect(screenUserMessage("nefes alamiyorum").verdict).toBe("block");
  });
});
