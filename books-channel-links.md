# Books channel link cleanup

The Books topic lives in `data/R_books.json`. The app loads that file. Nothing here is stored in Firestore, so this change is in the repo and no database write is required.

Checked on 2026-10-27. Replacements are the author's free copy, the publisher page, or the retail listing. Posts with no legal page were removed.

| Old link | Problem | New link or removal |
| --- | --- | --- |
| `https://amzn.to/3mx4PCu` labeled "Free PDF" on The Bitcoin Standard | Paid Amazon short link mislabeled as a free PDF. The book is copyrighted and has no legal free edition. | `https://www.amazon.com/dp/1119473861`, labeled Buy |
| "Another free PDF of The Bitcoin Standard:" with an empty link | Piracy pointer. The file link was already gone. | Removed |
| `https://ia601407.us.archive.org/.../The%20Bitcoin%20Standard...pdf` ("full book, free") | Unofficial Internet Archive upload of a copyrighted book | Removed |
| `https://drive.google.com/file/d/10gMJD34AB7tcSlwTJaWyLGcD2p1izfcK/view?usp=drivesdk` | Unofficial Drive copy of Tomer Strolight's Why Bitcoin? | `https://www.swanbitcoin.com/whybitcoin/` |
| `https://aul.primo.exlibrisgroup.com/discovery/fulldisplay?...docid=alma995901882406836` | Library catalog record, not the legal file | `https://hdl.handle.net/1721.1/153030` (MIT DSpace, CC BY 4.0 thesis) |
| `https://drive.google.com/file/d/15uMzo9qbV-GY4xNH7ZhenXuE_q5xO4ZL/view?usp=drivesdk` | Unofficial Drive copy of Softwar | `https://hdl.handle.net/1721.1/153030` |
| `https://drive.google.com/file/d/15uMzo9qbV-GY4xNH7ZhenXuE_q5xO4ZL/view?pli=1` and `https://aul.primo.exlibrisgroup.com/discovery/delivery/01AUL_INST:AUL/1297573990006836` (two posts) | Drive upload plus a library delivery link | `https://hdl.handle.net/1721.1/153030` |
| `https://drive.proton.me/urls/7C7VTHDQ24#LdATk9d2WGzY` | Proton Drive giveaway of What is Money? The Saylor Series | `https://www.michael.com/the-saylor-series` |
| `<@!232636672892731392>` | Raw Discord mention id | Replaced the id with "a community member". Book links in that post were left as they were. |
| Inventing Bitcoin "FREE LINK" with an empty `link` | The legal Swan page was missing from this post | `https://www.swanbitcoin.com/inventing-bitcoin/` |
| `https://web.archive.org/web/20220702091018/https://www.uncerto.com/book-pdf` | Archived `/book-pdf` path is dead (404). Not the authors' current file. | `https://uncerto.com/book` |
| `https://blog.bitmex.com/the-blocksize-war-chapter-1-first-strike/` | HTTP 200, but the body is the BitMEX wind-down homepage, not the chapter. The post also told readers to search BitMEX. | `https://farside.co.uk/the-blocksize-war/` |
| `https://a.co/4ch2itR` | Short link with no title. HTTP 500 / previously 404. | Removed |
| `https://store.bitcoinmagazine.com/collections/books/products/the-bitcoin-miners-almanac-pre-order` | Product URL 404 | `https://store.bitcoinmagazine.com/collections/books` |
| `https://store.bitcoinmagazine.com/collections/bitcoin-books` | Collection path redirects to the store homepage | `https://store.bitcoinmagazine.com/collections/books` |
| "Book of Satoshi free PDF Book_of_Satoshi.pdf" with no URL | Points at a filename for a copyrighted commentary | `https://satoshi.nakamotoinstitute.org/` (Satoshi's writings). The commentary stays a paid book. |
| The Bitcoin Effect posts with `link: "."` | Download claim with no file. Two copies. | `https://thebitcoineffect.com/` (author site, CC BY 4.0) |
| `https://archive.org/details/ConceivedInLiberty` | Archive.org copy. The Mises Institute is the publisher and offers the book free. | `https://mises.org/library/book/conceived-liberty` |
| `https://btcdir.org/links/books/` caption "many free pdfs included" | Page is a general link directory. No libgen, z-lib, Anna's Archive, Drive, or Proton links in the HTML. The free-PDF caption was not true of the page. | Same URL. Caption no longer says free PDFs are included. |

Left in place after a check:

- `https://theinternetofmoney.info/the-talks/` returned 403 to this network, which is a bot block, not a confirmed 404.
- `https://web.archive.org/web/20220121075601/https://bitcoinforkiddos.com/` is an archived kids site, not a scanned in-print book.
- `https://github.com/GMCyberFoundry/Metaverse/raw/draft/Book/metaverseBTC.pdf` is that project's own draft (the repo README describes the book). It is not a third-party upload.
- `littlebitcoinbook.com` was not in this channel. It was not added.
- Amazon short links other than the mislabeled Bitcoin Standard "Free PDF" were left. Earlier 503s on those hosts looked transient.
