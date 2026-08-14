// `server-only` paketi, sunucuya ait bir modül istemci paketine sızarsa
// derlemeyi kasten patlatır. Bu bir PAKETLEME koruması; Node altında
// çalışan testlerde anlamı yok ve import edildiğinde hata fırlatıyor.
//
// vitest.config.mts bu dosyayı `server-only` yerine takıyor. Koruma
// üretim derlemesinde aynen yerinde kalıyor — yalnızca test çalıştırıcısı
// için devre dışı.
export {};
