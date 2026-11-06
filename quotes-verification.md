# Quote of the Day verification

Checked 2026-10-22. A quote was kept only when its wording was a contiguous substring of a page or PDF fetched that day, after whitespace, HTML entities, curly quotes, and ligatures were normalized. Line-break hyphenation in PDFs was joined. Paraphrases were not stored as quotes.

## How the old card picked a quote

The list lived in `features.js` as `BITCOIN_QUOTES` (107 entries: `text`, `author`, `channel`). `renderDailyQuote` took the local day-of-year, `Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000)`, and used `BITCOIN_QUOTES[dayOfYear % length]`. That repeats long before the list is exhausted, and two people on the same calendar date in different time zones can see different lines.

The new picker uses the UTC date, shuffles the whole list once with a fixed seed (`0x51544F44`), and walks that order by day. The same UTC day shows the same quote everywhere, and every quote appears once before any repeat. The list is fetched from `data/quotes.json`. If that fetch fails, three quotes baked into `features.js` are used.

## Counts

- Old quotes: 107
- Kept with the same text: 5
- Removed or replaced: 102
- Quotes in the new file: 517
- New quotes (not an unchanged old line): 512

Names from the request that do not have a line here, because a primary page could not be fetched and matched: Milton Friedman (the 1999 interview transcript; a DePauw PDF that quotes it returned 403), Saifedean Ammous, Jack Dorsey, Jeff Booth, Jimmy Song, Nayib Bukele, and Max Keiser. Nothing was invented for them.

## New quotes

### 1. 99Bitcoins (2026)

> Since its start, Bitcoin has been called "dead" many times by doubters each time leading to predictions of its demise.

- Source: Bitcoin Obituaries
- URL: https://99bitcoins.com/bitcoin-obituaries/
- Verified: Fetched https://99bitcoins.com/bitcoin-obituaries/ on 2026-10-22. The page heading said "Bitcoin has died 477 times" (the old card said 474). That number moves, so the card uses this number-free sentence from the same page, verbatim. Year is the year the page was fetched; the sentence itself is undated site copy.

### 2. Adam Back (2002)

> A trapdoor-free cost-function is one where the server has no advantage in minting tokens.

- Source: Hashcash - A Denial of Service Counter-Measure
- URL: https://cdn.nakamotoinstitute.org/docs/hashcash.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/hashcash.pdf on 2026-10-22 (pdf, hashcash.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 3. Adam Back (2002)

> The hashcash CPU cost-function computes a token which can be used as a proof-of-work.

- Source: Hashcash - A Denial of Service Counter-Measure
- URL: https://cdn.nakamotoinstitute.org/docs/hashcash.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/hashcash.pdf on 2026-10-22 (pdf, hashcash.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 4. Andreas M. Antonopoulos (2014)

> As a developer, I see Bitcoin as akin to the internet of money, a network for propagating value and securing the ownership of digital assets via distributed computation.

- Source: Mastering Bitcoin, chapter 1
- URL: https://raw.githubusercontent.com/bitcoinbook/bitcoinbook/develop/ch01_intro.adoc
- Verified: Fetched the same chapter file. The sentence is his first-person line. Index markup in the file sits after the sentence and was not included.

### 5. Andreas M. Antonopoulos (2014)

> Nature demonstrates that decentralized systems can be resilient and can produce emergent complexity and incredible sophistication without the need for a central authority, hierarchy, or complex parts.

- Source: Mastering Bitcoin, preface
- URL: https://raw.githubusercontent.com/bitcoinbook/bitcoinbook/develop/preface.adoc
- Verified: Fetched the preface source from the bitcoinbook repository on 2026-10-22 (byte-identical to the local copy). The paragraph is in the section Andreas writes about the cover, in the first person ("I (Andreas)").

### 6. Andreas M. Antonopoulos (2014)

> The protocol also periodically decreases the number of new bitcoins that are created, limiting the total number of bitcoins that will ever be created to a fixed total just below 21 million coins.

- Source: Mastering Bitcoin, chapter 1
- URL: https://raw.githubusercontent.com/bitcoinbook/bitcoinbook/develop/ch01_intro.adoc
- Verified: Fetched ch01_intro.adoc from the bitcoinbook repository on 2026-10-22 (byte-identical to the local copy). Whitespace was collapsed. The old card line about a central bank printing more was not this sentence and was not kept.

### 7. Carl Menger (1892)

> Are we to refer its commercial currency and its value in trade to the same causes conditioning those of other goods, or are they the distinct product of convention and authority?

- Source: On the Origins of Money
- URL: https://cdn.nakamotoinstitute.org/docs/on-the-origins-of-money.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/on-the-origins-of-money.pdf on 2026-10-22 (pdf, on-the-origins-of-money.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 8. Carl Menger (1892)

> The difference existing in this respect between articles of commerce is of the highest degree of significance for the theory of money, and of the market in general.

- Source: On the Origins of Money
- URL: https://cdn.nakamotoinstitute.org/docs/on-the-origins-of-money.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/on-the-origins-of-money.pdf on 2026-10-22 (pdf, on-the-origins-of-money.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 9. Carl Menger (1892)

> The most cursory observation of market phenomena teaches us that it does not lie within our power, when we have bought an article for a certain price, to sell it again forthwith at the same price.

- Source: On the Origins of Money
- URL: https://cdn.nakamotoinstitute.org/docs/on-the-origins-of-money.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/on-the-origins-of-money.pdf on 2026-10-22 (pdf, on-the-origins-of-money.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 10. Carl Menger (1892)

> The price at which any one can at pleasure buy a commodity at a given market and a given point of time, and the price at which he can dispose of the same at pleasure, are two essentially different magnitudes.

- Source: On the Origins of Money
- URL: https://cdn.nakamotoinstitute.org/docs/on-the-origins-of-money.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/on-the-origins-of-money.pdf on 2026-10-22 (pdf, on-the-origins-of-money.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 11. Carl Menger (1892)

> To gain the same command over what the market affords, he must first convert his exchangeable goods into money.

- Source: On the Origins of Money
- URL: https://cdn.nakamotoinstitute.org/docs/on-the-origins-of-money.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/on-the-origins-of-money.pdf on 2026-10-22 (pdf, on-the-origins-of-money.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 12. Chuck Hammill (1987)

> Now, when the price of oil drops, again we risk problems, this time because American oil companies and Third World basket-case nations who sell oil may not be able to ever pay their debts to our grossly over-extended banks.

- Source: From Crossbows To Cryptography: Techno-Thwarting The State
- URL: https://nakamotoinstitute.org/library/from-crossbows-to-cryptography/
- Verified: Fetched https://nakamotoinstitute.org/library/from-crossbows-to-cryptography/ on 2026-10-22 (library-html, from-crossbows-to-cryptography.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 13. Chuck Hammill (1987)

> Once freedom contracts beyond a certain minimum extent, the state warps the fabric of the political continuum about itself to the degree that subsequent re-emergence of freedom becomes all but impossible.

- Source: From Crossbows To Cryptography: Techno-Thwarting The State
- URL: https://nakamotoinstitute.org/library/from-crossbows-to-cryptography/
- Verified: Fetched https://nakamotoinstitute.org/library/from-crossbows-to-cryptography/ on 2026-10-22 (library-html, from-crossbows-to-cryptography.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 14. Chuck Hammill (1987)

> The suggested panacea is that government should now re-raise the oil prices that OPEC has lowered, via a new oil tax.

- Source: From Crossbows To Cryptography: Techno-Thwarting The State
- URL: https://nakamotoinstitute.org/library/from-crossbows-to-cryptography/
- Verified: Fetched https://nakamotoinstitute.org/library/from-crossbows-to-cryptography/ on 2026-10-22 (library-html, from-crossbows-to-cryptography.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 15. Chuck Hammill (1987)

> When the liberals and other collectivists began to attack freedom, they possessed a reasonably stable, healthy, functioning economy, and almost unlimited time to proceed to hamstring and dismantle it.

- Source: From Crossbows To Cryptography: Techno-Thwarting The State
- URL: https://nakamotoinstitute.org/library/from-crossbows-to-cryptography/
- Verified: Fetched https://nakamotoinstitute.org/library/from-crossbows-to-cryptography/ on 2026-10-22 (library-html, from-crossbows-to-cryptography.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 16. David Chaum (1985)

> Before making payment sometime later, the individual removes the envelope and carbon, leaving only the signed slip of paper.

- Source: Security Without Identification: Card Computers to Make Big Brother Obsolete
- URL: https://nakamotoinstitute.org/library/security-without-identification/
- Verified: Fetched https://nakamotoinstitute.org/library/security-without-identification/ on 2026-10-22 (library-html, security-without-identification.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 17. David Chaum (1985)

> In short, no proofs of security are known for these cryptographic codes. but nor are any feasible attacks.

- Source: Security Without Identification: Card Computers to Make Big Brother Obsolete
- URL: https://nakamotoinstitute.org/library/security-without-identification/
- Verified: Fetched https://nakamotoinstitute.org/library/security-without-identification/ on 2026-10-22 (library-html, security-without-identification.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 18. David Chaum (1985)

> In the long run, it holds promise for enhancing economic freedom, the democratic process, and informational rights.

- Source: Security Without Identification: Card Computers to Make Big Brother Obsolete
- URL: https://nakamotoinstitute.org/library/security-without-identification/
- Verified: Fetched https://nakamotoinstitute.org/library/security-without-identification/ on 2026-10-22 (library-html, security-without-identification.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 19. David Chaum (1985)

> The systems presented here for the new approach depend on currently used codes to secure organizations against abuses by individuals.

- Source: Security Without Identification: Card Computers to Make Big Brother Obsolete
- URL: https://nakamotoinstitute.org/library/security-without-identification/
- Verified: Fetched https://nakamotoinstitute.org/library/security-without-identification/ on 2026-10-22 (library-html, security-without-identification.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 20. David Chaum (1985)

> The way these techniques work is illustrated by applying the envelope analogy to buying goods on credit.

- Source: Security Without Identification: Card Computers to Make Big Brother Obsolete
- URL: https://nakamotoinstitute.org/library/security-without-identification/
- Verified: Fetched https://nakamotoinstitute.org/library/security-without-identification/ on 2026-10-22 (library-html, security-without-identification.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 21. David D. Friedman (2005)

> As the example of credit bureaus suggests, there are practical difficulties with protecting privacy by letting other people have information and then controlling what they do with it.

- Source: The Case for Privacy
- URL: https://nakamotoinstitute.org/library/the-case-for-privacy/
- Verified: Fetched https://nakamotoinstitute.org/library/the-case-for-privacy/ on 2026-10-22 (library-html, the-case-for-privacy.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 22. David D. Friedman (2005)

> Freedom of speech will no longer depend on how the Supreme Court interprets the First Amendment.

- Source: The Case for Privacy
- URL: https://nakamotoinstitute.org/library/the-case-for-privacy/
- Verified: Fetched https://nakamotoinstitute.org/library/the-case-for-privacy/ on 2026-10-22 (library-html, the-case-for-privacy.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 23. David D. Friedman (2005)

> The answer to "what faction can be trusted with a monopoly over the shield" is "no." The right question is how the shield will affect the world—how it will alter the balance between freedom and oppression, individual and state, small and big.

- Source: The Case for Privacy
- URL: https://nakamotoinstitute.org/library/the-case-for-privacy/
- Verified: Fetched https://nakamotoinstitute.org/library/the-case-for-privacy/ on 2026-10-22 (library-html, the-case-for-privacy.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 24. David D. Friedman (2005)

> The first was that I did, and he did not, define privacy in the context of freedom of association.

- Source: The Case for Privacy
- URL: https://nakamotoinstitute.org/library/the-case-for-privacy/
- Verified: Fetched https://nakamotoinstitute.org/library/the-case-for-privacy/ on 2026-10-22 (library-html, the-case-for-privacy.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 25. Eric Hughes (1993)

> An anonymous system empowers individuals to reveal their identity when desired and only when desired; this is the essence of privacy.

- Source: A Cypherpunk's Manifesto
- URL: https://nakamotoinstitute.org/library/cypherpunk-manifesto/
- Verified: Fetched https://nakamotoinstitute.org/library/cypherpunk-manifesto/ on 2026-10-22 (library-html, cypherpunk-manifesto.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 26. Eric Hughes (1993)

> Cypherpunks write code.

- Source: A Cypherpunk's Manifesto
- URL: https://nakamotoinstitute.org/library/cypherpunk-manifesto/
- Verified: Fetched https://nakamotoinstitute.org/library/cypherpunk-manifesto/ on 2026-10-22. The sentence is in the essay. It is short, so the length filter had dropped it; it is included on purpose.

### 27. Eric Hughes (1993)

> Even laws against cryptography reach only so far as a nation's border and the arm of its violence.

- Source: A Cypherpunk's Manifesto
- URL: https://nakamotoinstitute.org/library/cypherpunk-manifesto/
- Verified: Fetched https://nakamotoinstitute.org/library/cypherpunk-manifesto/ on 2026-10-22 (library-html, cypherpunk-manifesto.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 28. Eric Hughes (1993)

> One could pass laws against it, but the freedom of speech, even more than privacy, is fundamental to an open society; we seek not to restrict any speech at all.

- Source: A Cypherpunk's Manifesto
- URL: https://nakamotoinstitute.org/library/cypherpunk-manifesto/
- Verified: Fetched https://nakamotoinstitute.org/library/cypherpunk-manifesto/ on 2026-10-22 (library-html, cypherpunk-manifesto.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 29. Eric Hughes (1993)

> People have been defending their own privacy for centuries with whispers, darkness, envelopes, closed doors, secret handshakes, and couriers.

- Source: A Cypherpunk's Manifesto
- URL: https://nakamotoinstitute.org/library/cypherpunk-manifesto/
- Verified: Fetched https://nakamotoinstitute.org/library/cypherpunk-manifesto/ on 2026-10-22 (library-html, cypherpunk-manifesto.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 30. Eric Hughes (1993)

> Privacy is necessary for an open society in the electronic age.

- Source: A Cypherpunk's Manifesto
- URL: https://nakamotoinstitute.org/library/cypherpunk-manifesto/
- Verified: Fetched https://nakamotoinstitute.org/library/cypherpunk-manifesto/ on 2026-10-22. The sentence opens the essay.

### 31. Eric Hughes (1993)

> The power of electronic communications has enabled such group speech, and it will not go away merely because we might want it to.

- Source: A Cypherpunk's Manifesto
- URL: https://nakamotoinstitute.org/library/cypherpunk-manifesto/
- Verified: Fetched https://nakamotoinstitute.org/library/cypherpunk-manifesto/ on 2026-10-22 (library-html, cypherpunk-manifesto.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 32. Eric Hughes (1993)

> The technologies of the past did not allow for strong privacy, but electronic technologies do.

- Source: A Cypherpunk's Manifesto
- URL: https://nakamotoinstitute.org/library/cypherpunk-manifesto/
- Verified: Fetched https://nakamotoinstitute.org/library/cypherpunk-manifesto/ on 2026-10-22 (library-html, cypherpunk-manifesto.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 33. Eric Hughes (1993)

> We are defending our privacy with cryptography, with anonymous mail forwarding systems, with digital signatures, and with electronic money.

- Source: A Cypherpunk's Manifesto
- URL: https://nakamotoinstitute.org/library/cypherpunk-manifesto/
- Verified: Fetched https://nakamotoinstitute.org/library/cypherpunk-manifesto/ on 2026-10-22 (library-html, cypherpunk-manifesto.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 34. Eric Hughes (1993)

> We cannot expect governments, corporations, or other large, faceless organizations to grant us privacy out of their beneficence.

- Source: A Cypherpunk's Manifesto
- URL: https://nakamotoinstitute.org/library/cypherpunk-manifesto/
- Verified: Fetched https://nakamotoinstitute.org/library/cypherpunk-manifesto/ on 2026-10-22 (library-html, cypherpunk-manifesto.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 35. Eric Hughes (1993)

> We must come together and create systems which allow anonymous transactions to take place.

- Source: A Cypherpunk's Manifesto
- URL: https://nakamotoinstitute.org/library/cypherpunk-manifesto/
- Verified: Fetched https://nakamotoinstitute.org/library/cypherpunk-manifesto/ on 2026-10-22 (library-html, cypherpunk-manifesto.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 36. Eric Hughes (1993)

> We must defend our own privacy if we expect to have any.

- Source: A Cypherpunk's Manifesto
- URL: https://nakamotoinstitute.org/library/cypherpunk-manifesto/
- Verified: Fetched the same manifesto. The sentence is the start of the second paragraph.

### 37. Eric Hughes (1993)

> We publish our code so that our fellow Cypherpunks may practice and play with it.

- Source: A Cypherpunk's Manifesto
- URL: https://nakamotoinstitute.org/library/cypherpunk-manifesto/
- Verified: Fetched https://nakamotoinstitute.org/library/cypherpunk-manifesto/ on 2026-10-22 (library-html, cypherpunk-manifesto.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 38. Friedrich A. Hayek (1978)

> For more than 2,000 years the government prerogative or exclusive right of supplying money amounted in practice merely to the monopoly of minting coins of gold, silver or copper.

- Source: Denationalisation of Money
- URL: https://cdn.nakamotoinstitute.org/docs/denationalisation.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/denationalisation.pdf on 2026-10-22 (pdf, denationalisation.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 39. Friedrich A. Hayek (1978)

> Governments have at all times had a strong interest in persuading the public that the right to issue money belongs exclusively to them.

- Source: Denationalisation of Money
- URL: https://cdn.nakamotoinstitute.org/docs/denationalisation.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/denationalisation.pdf on 2026-10-22 (pdf, denationalisation.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 40. Friedrich A. Hayek (1978)

> In so far as government possesses the monopoly of issuing money and uses it to establish one kind of money, it must probably also have power to say by what kind of objects debts expressed in its currency can be discharged.

- Source: Denationalisation of Money
- URL: https://cdn.nakamotoinstitute.org/docs/denationalisation.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/denationalisation.pdf on 2026-10-22 (pdf, denationalisation.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 41. Friedrich A. Hayek (1978)

> In this condition the value of the currency issued by one bank would not necessarily be affected by the supplies of other currencies by different institutions (private or governmental).

- Source: Denationalisation of Money
- URL: https://cdn.nakamotoinstitute.org/docs/denationalisation.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/denationalisation.pdf on 2026-10-22 (pdf, denationalisation.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 42. Friedrich A. Hayek (1978)

> One might hope to prevent the violent fluctuations in the value of money in recent years by returning to the gold standard or some regime of fixed exchanges.

- Source: Denationalisation of Money
- URL: https://cdn.nakamotoinstitute.org/docs/denationalisation.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/denationalisation.pdf on 2026-10-22 (pdf, denationalisation.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 43. Friedrich A. Hayek (1978)

> Only because people could freely choose which currency to use for their different purposes would the process of selection lead to the good money prevailing.

- Source: Denationalisation of Money
- URL: https://cdn.nakamotoinstitute.org/docs/denationalisation.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/denationalisation.pdf on 2026-10-22 (pdf, denationalisation.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 44. Friedrich A. Hayek (1978)

> Only because there was active trading on the currency exchange would the issuing banks be warned to take the required action in time.

- Source: Denationalisation of Money
- URL: https://cdn.nakamotoinstitute.org/docs/denationalisation.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/denationalisation.pdf on 2026-10-22 (pdf, denationalisation.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 45. Friedrich A. Hayek (1978)

> People would learn to trust the new money only if they were confident it was completely exempt from any government control.

- Source: Denationalisation of Money
- URL: https://cdn.nakamotoinstitute.org/docs/denationalisation.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/denationalisation.pdf on 2026-10-22 (pdf, denationalisation.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 46. Friedrich A. Hayek (1978)

> The kind of trust on which private money would rest would not be very different from the trust on which today all private banking rests (or in the United States rested before the governmental deposit insurance scheme!).

- Source: Denationalisation of Money
- URL: https://cdn.nakamotoinstitute.org/docs/denationalisation.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/denationalisation.pdf on 2026-10-22 (pdf, denationalisation.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 47. Friedrich A. Hayek (1978)

> The system was for that reason more correctly described as an alternative standard, the value of a currency depending on the metal which for the time being was over-valued.

- Source: Denationalisation of Money
- URL: https://cdn.nakamotoinstitute.org/docs/denationalisation.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/denationalisation.pdf on 2026-10-22 (pdf, denationalisation.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 48. Friedrich A. Hayek (1978)

> What then do we call, in a world of constantly changing individual prices, a stable value of money?

- Source: Denationalisation of Money
- URL: https://cdn.nakamotoinstitute.org/docs/denationalisation.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/denationalisation.pdf on 2026-10-22 (pdf, denationalisation.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 49. Friedrich A. Hayek (1978)

> When one studies the history of money one cannot help wondering why people should have put up for so long with governments exercising an exclusive power over 2,000 years that was regularly used to exploit and defraud them.

- Source: Denationalisation of Money
- URL: https://cdn.nakamotoinstitute.org/docs/denationalisation.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/denationalisation.pdf on 2026-10-22 (pdf, denationalisation.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 50. Gigi (2019)

> All three phenomena — electricity, the internet, Bitcoin — are enabling technologies, networks which enable other things.

- Source: 21 Lessons: Metaphors for Bitcoin's future
- URL: https://21lessons.com/21/
- Verified: Fetched https://21lessons.com/21/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 51. Gigi (2019)

> Another consequence of hyperinflation is that all the money which people have saved over the course of their life will effectively vanish.

- Source: 21 Lessons: Inflation
- URL: https://21lessons.com/9/
- Verified: Fetched https://21lessons.com/9/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 52. Gigi (2019)

> As bitcoin approaches infinite stock to flow ratio it will be the soundest money in existence.

- Source: 21 Lessons: Sound money
- URL: https://21lessons.com/14/
- Verified: Fetched https://21lessons.com/14/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 53. Gigi (2019)

> As more time passes, more and more people will recognize Bitcoin as something which simply is.

- Source: 21 Lessons: Metaphors for Bitcoin's future
- URL: https://21lessons.com/21/
- Verified: Fetched https://21lessons.com/21/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 54. Gigi (2019)

> As the inflating currency falls apart, it will fail to store value over time and people will rush to get their hands on any goods which might do.

- Source: 21 Lessons: Inflation
- URL: https://21lessons.com/9/
- Verified: Fetched https://21lessons.com/9/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 55. Gigi (2019)

> Bitcoin aims to replace, or at least provide an alternative to, conventional currency.

- Source: 21 Lessons: Reflections on "Don't Trust, Verify"
- URL: https://21lessons.com/16/
- Verified: Fetched https://21lessons.com/16/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 56. Gigi (2019)

> Bitcoin is an inexhaustible teacher, which is why I do not claim that these lessons are all-encompassing or complete.

- Source: 21 Lessons: Preface
- URL: https://21lessons.com/preface
- Verified: Fetched https://21lessons.com/preface on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 57. Gigi (2019)

> Bitcoin is not only borderless in regards to its inner workings but also boundaryless in respect to academic disciplines.

- Source: 21 Lessons: Conclusion
- URL: https://21lessons.com/conclusion
- Verified: Fetched https://21lessons.com/conclusion on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 58. Gigi (2019)

> Bitcoin is probably the one system which comes closest to this utopia, but still, it is trust-minimized — aiming to remove trust wherever possible.

- Source: 21 Lessons: Reflections on "Don't Trust, Verify"
- URL: https://21lessons.com/16/
- Verified: Fetched https://21lessons.com/16/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 59. Gigi (2019)

> Bitcoin solves the problem of trust by being completely decentralized, with no central server or trusted parties.

- Source: 21 Lessons: Reflections on "Don't Trust, Verify"
- URL: https://21lessons.com/16/
- Verified: Fetched https://21lessons.com/16/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 60. Gigi (2019)

> Bitcoin taught me about the hidden tax of inflation and the catastrophe of hyperinflation.

- Source: 21 Lessons: Inflation
- URL: https://21lessons.com/9/
- Verified: Fetched https://21lessons.com/9/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 61. Gigi (2019)

> Bitcoin taught me that telling the time is tricky, especially if you are decentralized.

- Source: 21 Lessons: Telling time takes work
- URL: https://21lessons.com/17/
- Verified: Fetched https://21lessons.com/17/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 62. Gigi (2019)

> Bitcoin taught me that understanding the past is essential to understanding its future.

- Source: 21 Lessons: Metaphors for Bitcoin's future
- URL: https://21lessons.com/21/
- Verified: Fetched https://21lessons.com/21/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 63. Gigi (2019)

> Bitcoin, an advanced technology in itself, breaks this trend and creates a new commodity which is truly scarce.

- Source: 21 Lessons: The scarcity of scarcity
- URL: https://21lessons.com/2/
- Verified: Fetched https://21lessons.com/2/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 64. Gigi (2019)

> Code which took an abstract idea and proved to the world that it actually worked.

- Source: 21 Lessons: Cypherpunks write code
- URL: https://21lessons.com/20/
- Verified: Fetched https://21lessons.com/20/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 65. Gigi (2019)

> Even without understanding it fully, and even with all its quirks and seeming shortcomings, Bitcoin undoubtedly works.

- Source: 21 Lessons: Conclusion
- URL: https://21lessons.com/conclusion
- Verified: Fetched https://21lessons.com/conclusion on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 66. Gigi (2019)

> Further, Bitcoin is evolving and it's almost impossible to stay up-to-date with the accelerating rate of innovation.

- Source: 21 Lessons: The limits of knowledge
- URL: https://21lessons.com/7/
- Verified: Fetched https://21lessons.com/7/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 67. Gigi (2019)

> Heck, Bitcoin even copies itself onto as many computers as it can, by incentivizing individual people to run full nodes and mine new blocks.

- Source: 21 Lessons: The scarcity of scarcity
- URL: https://21lessons.com/2/
- Verified: Fetched https://21lessons.com/2/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 68. Gigi (2019)

> I wonder if people would still be willing to accrue as much debt as they currently do if everyone would be educated in personal finance and the workings of money and debt.

- Source: 21 Lessons: Financial ignorance
- URL: https://21lessons.com/8/
- Verified: Fetched https://21lessons.com/8/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 69. Gigi (2019)

> In a time of abundance, Bitcoin taught me what real scarcity is.

- Source: 21 Lessons: The scarcity of scarcity
- URL: https://21lessons.com/2/
- Verified: Fetched https://21lessons.com/2/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 70. Gigi (2019)

> It seems that proof-of-work is still widely misunderstood today, in the year 13 AB (after Bitcoin).

- Source: 21 Lessons: Telling time takes work
- URL: https://21lessons.com/17/
- Verified: Fetched https://21lessons.com/17/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 71. Gigi (2019)

> It speaks of many things which Bitcoin enables and utilizes, such as direct and private transactions, electronic money and cash, anonymous systems, and defending privacy with cryptography and digital signatures.

- Source: 21 Lessons: Cypherpunks write code
- URL: https://21lessons.com/20/
- Verified: Fetched https://21lessons.com/20/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 72. Gigi (2019)

> Learning all the fundamentals which make Bitcoin work is hard.

- Source: 21 Lessons: The limits of knowledge
- URL: https://21lessons.com/7/
- Verified: Fetched https://21lessons.com/7/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 73. Gigi (2019)

> Lessons about financial ignorance, inflation, value, money and the history of money, fractional reserve banking, and how Bitcoin is re-introducing sound money in a sly, roundabout way.

- Source: 21 Lessons: Introduction
- URL: https://21lessons.com/intro
- Verified: Fetched https://21lessons.com/intro on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 74. Gigi (2019)

> Like a five-year-old, I began to ask myself a lot of questions: How does the banking system work?

- Source: 21 Lessons: Financial ignorance
- URL: https://21lessons.com/8/
- Verified: Fetched https://21lessons.com/8/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 75. Gigi (2019)

> Since Bitcoin is just software and all of it is open-source, you can simply change things at will, right?

- Source: 21 Lessons: Immutability and change
- URL: https://21lessons.com/1/
- Verified: Fetched https://21lessons.com/1/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 76. Gigi (2019)

> Thanks to this code, everyone can verify that this novel system actually works, and every 10 minutes or so Bitcoin proofs to the world that it is still living.

- Source: 21 Lessons: Cypherpunks write code
- URL: https://21lessons.com/20/
- Verified: Fetched https://21lessons.com/20/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 77. Gigi (2019)

> The abolishment of the gold standard gave way to a new reality: adding new money requires just a drop of ink.

- Source: 21 Lessons: Sound money
- URL: https://21lessons.com/14/
- Verified: Fetched https://21lessons.com/14/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 78. Gigi (2019)

> The dust of the first layer hasn't even settled yet, and people have already built the second layer and are working on the third.

- Source: 21 Lessons: The limits of knowledge
- URL: https://21lessons.com/7/
- Verified: Fetched https://21lessons.com/7/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 79. Gigi (2019)

> The interplay of immutability and change, the concept of true scarcity, Bitcoin's immaculate conception, the problem of identity, the contradiction of replication and locality, the power of free speech, and the limits of knowledge.

- Source: 21 Lessons: Introduction
- URL: https://21lessons.com/intro
- Verified: Fetched https://21lessons.com/intro on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 80. Gigi (2019)

> The longer Bitcoin continues to work, the more people will opt-in to use it.

- Source: 21 Lessons: Conclusion
- URL: https://21lessons.com/conclusion
- Verified: Fetched https://21lessons.com/conclusion on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 81. Gigi (2019)

> The software is just one piece of the puzzle, and hoping to change Bitcoin by changing the software is an exercise in futility.

- Source: 21 Lessons: Immutability and change
- URL: https://21lessons.com/1/
- Verified: Fetched https://21lessons.com/1/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 82. Gigi (2019)

> The things I've learned are, obviously, about Bitcoin - or at least related to it.

- Source: 21 Lessons: Introduction
- URL: https://21lessons.com/intro
- Verified: Fetched https://21lessons.com/intro on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 83. Gigi (2019)

> There are many more lessons to be learned, and every person will learn something different from entering the world of Bitcoin.

- Source: 21 Lessons: Preface
- URL: https://21lessons.com/preface
- Verified: Fetched https://21lessons.com/preface on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 84. Gigi (2019)

> To paraphrase a little guy with hairy feet: "It's a dangerous business, Frodo, stepping into Bitcoin.

- Source: 21 Lessons: Financial ignorance
- URL: https://21lessons.com/8/
- Verified: Fetched https://21lessons.com/8/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 85. Gigi (2019)

> Unlike Bitcoin, future versions of this project do not have to be backward compatible.

- Source: 21 Lessons: Preface
- URL: https://21lessons.com/preface
- Verified: Fetched https://21lessons.com/preface on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 86. Gigi (2019)

> What is true for Picasso's paintings, Elvis Presley's guitars, and Stradivarius violins is also true for fiat currency, gold, and bitcoins.

- Source: 21 Lessons: Sound money
- URL: https://21lessons.com/14/
- Verified: Fetched https://21lessons.com/14/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 87. Gigi (2019)

> Whatever your favorite analogy might be, two aspects of Bitcoin are absolutely essential: decentralization and immutability.

- Source: 21 Lessons: Immutability and change
- URL: https://21lessons.com/1/
- Verified: Fetched https://21lessons.com/1/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 88. Gigi (2019)

> When I first learned how Bitcoin works I also thought that proof-of-work is inefficient and wasteful.

- Source: 21 Lessons: Telling time takes work
- URL: https://21lessons.com/17/
- Verified: Fetched https://21lessons.com/17/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 89. Gwern Branwen (2011)

> Bitcoin assumes that the majority of nodes in its network are honest, and resorts to a majority vote mechanism for double spending avoidance, and dispute resolution.

- Source: Bitcoin Is Worse Is Better
- URL: https://nakamotoinstitute.org/library/bitcoin-is-worse-is-better/
- Verified: Fetched https://nakamotoinstitute.org/library/bitcoin-is-worse-is-better/ on 2026-10-22 (library-html, bitcoin-is-worse-is-better.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 90. Gwern Branwen (2011)

> Due to the cryptographic nature of transactions, it's simply not possible to have realtime transactions with bitcoin as the network scales (it already take 5--10 mins on average for the network to see a single transaction).

- Source: Bitcoin Is Worse Is Better
- URL: https://nakamotoinstitute.org/library/bitcoin-is-worse-is-better/
- Verified: Fetched https://nakamotoinstitute.org/library/bitcoin-is-worse-is-better/ on 2026-10-22 (library-html, bitcoin-is-worse-is-better.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 91. Gwern Branwen (2011)

> Since Bitcoin- or bit gold- denominated contracts generally exist outside the system, one would have to, at the very least, publicly register those contracts signed by the parties' keys for creditor or debtor status to be provable.

- Source: Bitcoin Is Worse Is Better
- URL: https://nakamotoinstitute.org/library/bitcoin-is-worse-is-better/
- Verified: Fetched https://nakamotoinstitute.org/library/bitcoin-is-worse-is-better/ on 2026-10-22 (library-html, bitcoin-is-worse-is-better.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 92. Hal Finney (1993)

> All the bank knows is how much I have withdrawn each month; I may or may not have spent it at that time.

- Source: Digital Cash & Privacy
- URL: https://nakamotoinstitute.org/library/digital-cash-and-privacy/
- Verified: Fetched https://nakamotoinstitute.org/library/digital-cash-and-privacy/ on 2026-10-22 (library-html, digital-cash-and-privacy.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 93. Hal Finney (1993)

> Every month I send a check to the bank to cover my account just as I do with my credit cards.

- Source: Digital Cash & Privacy
- URL: https://nakamotoinstitute.org/library/digital-cash-and-privacy/
- Verified: Fetched https://nakamotoinstitute.org/library/digital-cash-and-privacy/ on 2026-10-22 (library-html, digital-cash-and-privacy.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 94. Hal Finney (1993)

> I think that the convenience of credit and debit cards will overcome most people's privacy concerns and that we will find ourselves in a situation where great volumes of information exist about people's private lives.

- Source: Digital Cash & Privacy
- URL: https://nakamotoinstitute.org/library/digital-cash-and-privacy/
- Verified: Fetched https://nakamotoinstitute.org/library/digital-cash-and-privacy/ on 2026-10-22 (library-html, digital-cash-and-privacy.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 95. Hal Finney (1993)

> In this model, imagine that the bank is granting me credit similar to a credit card.

- Source: Digital Cash & Privacy
- URL: https://nakamotoinstitute.org/library/digital-cash-and-privacy/
- Verified: Fetched https://nakamotoinstitute.org/library/digital-cash-and-privacy/ on 2026-10-22 (library-html, digital-cash-and-privacy.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 96. Hal Finney (1994)

> Again, we need to win political, not technological, victories in order to protect our privacy.

- Source: Politics vs Technology
- URL: https://nakamotoinstitute.org/library/politics-vs-technology/
- Verified: Fetched https://nakamotoinstitute.org/library/politics-vs-technology/ on 2026-10-22 (library-html, politics-vs-technology.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 97. Hal Finney (1994)

> Fundamentally, I believe we will have the kind of society that most people want.

- Source: Politics vs Technology
- URL: https://nakamotoinstitute.org/library/politics-vs-technology/
- Verified: Fetched https://nakamotoinstitute.org/library/politics-vs-technology/ on 2026-10-22 (library-html, politics-vs-technology.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 98. Hal Finney (1994)

> Have people forgotten the Clipper proposal, with the possible follow-on to make non-Clipper encryption illegal?

- Source: Politics vs Technology
- URL: https://nakamotoinstitute.org/library/politics-vs-technology/
- Verified: Fetched https://nakamotoinstitute.org/library/politics-vs-technology/ on 2026-10-22 (library-html, politics-vs-technology.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 99. Hal Finney (1994)

> If anyone has any suggestions for how to escape from jail into cyberspace I'd like to hear about them.

- Source: Politics vs Technology
- URL: https://nakamotoinstitute.org/library/politics-vs-technology/
- Verified: Fetched https://nakamotoinstitute.org/library/politics-vs-technology/ on 2026-10-22 (library-html, politics-vs-technology.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 100. Hal Finney (1994)

> If we want freedom and privacy, we must persuade others that these are worth having.

- Source: Politics vs Technology
- URL: https://nakamotoinstitute.org/library/politics-vs-technology/
- Verified: Fetched https://nakamotoinstitute.org/library/politics-vs-technology/ on 2026-10-22 (library-html, politics-vs-technology.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 101. Hal Finney (1994)

> In those days, paper money was issued by private banks (usually with state charters).

- Source: The Beauty of ECash
- URL: https://nakamotoinstitute.org/library/the-beauty-of-ecash/
- Verified: Fetched https://nakamotoinstitute.org/library/the-beauty-of-ecash/ on 2026-10-22 (library-html, the-beauty-of-ecash.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 102. Hal Finney (1994)

> One might even have an early banknote notarized (digitally timestamped) so that one could prove its value in later years.

- Source: The Beauty of ECash
- URL: https://nakamotoinstitute.org/library/the-beauty-of-ecash/
- Verified: Fetched https://nakamotoinstitute.org/library/the-beauty-of-ecash/ on 2026-10-22 (library-html, the-beauty-of-ecash.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 103. Hal Finney (1994)

> The Magic Money system has a provision for the bank to periodically move to another set of exponents to represent the same denominations (in order to keep the size of the note database from growing too large).

- Source: The Beauty of ECash
- URL: https://nakamotoinstitute.org/library/the-beauty-of-ecash/
- Verified: Fetched https://nakamotoinstitute.org/library/the-beauty-of-ecash/ on 2026-10-22 (library-html, the-beauty-of-ecash.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 104. Hal Finney (2004)

> Please keep in mind that if there are problems I may need to reload the server code, which will invalidate any RPOW tokens which people have previously created.

- Source: RPOW - Reusable Proofs of Work
- URL: https://nakamotoinstitute.org/library/rpow/
- Verified: Fetched https://nakamotoinstitute.org/library/rpow/ on 2026-10-22 (library-html, rpow.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 105. Hal Finney (2004)

> RPOWs can then be transferred from person to person and exchanged for new RPOWs at each step.

- Source: RPOW - Reusable Proofs of Work
- URL: https://nakamotoinstitute.org/library/rpow/
- Verified: Fetched https://nakamotoinstitute.org/library/rpow/ on 2026-10-22 (library-html, rpow.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 106. Hal Finney (2004)

> There is also a crude web interface which lets you exchange POWs for RPOWs without downloading the client.

- Source: RPOW - Reusable Proofs of Work
- URL: https://nakamotoinstitute.org/library/rpow/
- Verified: Fetched https://nakamotoinstitute.org/library/rpow/ on 2026-10-22 (library-html, rpow.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 107. Hal Finney (2009)

> Running bitcoin

- Source: Twitter @halfin, 10 Jan 2009
- URL: https://web.archive.org/web/20170328054440/https://twitter.com/halfin/status/1110302988
- Verified: Fetched the Internet Archive capture of https://twitter.com/halfin/status/1110302988 (archived 2017-03-28). The tweet text is "Running bitcoin" and the timestamp title is "7:33 PM - 10 Jan 2009".

### 108. Hal Finney (2013)

> As the price climbed up to real money, I transferred the coins into an offline wallet, where hopefully they'll be worth something to my heirs.

- Source: Bitcoin and Me
- URL: https://nakamotoinstitute.org/library/bitcoin-and-me/
- Verified: Fetched https://nakamotoinstitute.org/library/bitcoin-and-me/ on 2026-10-22 (library-html, bitcoin-and-me.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 109. Hal Finney (2013)

> Currently I'm working on something Mike Hearn suggested, using the security features of modern processors, designed to support "Trusted Computing", to harden Bitcoin wallets.

- Source: Bitcoin and Me
- URL: https://nakamotoinstitute.org/library/bitcoin-and-me/
- Verified: Fetched https://nakamotoinstitute.org/library/bitcoin-and-me/ on 2026-10-22 (library-html, bitcoin-and-me.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 110. Hal Finney (2013)

> I had made an attempt to create my own proof of work based currency, called RPOW.

- Source: Bitcoin and Me
- URL: https://nakamotoinstitute.org/library/bitcoin-and-me/
- Verified: Fetched https://nakamotoinstitute.org/library/bitcoin-and-me/ on 2026-10-22 (library-html, bitcoin-and-me.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 111. Hal Finney (2013)

> I ran the first cryptographically based anonymous remailer, among other activities.

- Source: Bitcoin and Me
- URL: https://nakamotoinstitute.org/library/bitcoin-and-me/
- Verified: Fetched https://nakamotoinstitute.org/library/bitcoin-and-me/ on 2026-10-22 (library-html, bitcoin-and-me.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 112. Hal Finney (2013)

> I thought I'd write about the last four years, an eventful time for Bitcoin and me.

- Source: Bitcoin and Me
- URL: https://nakamotoinstitute.org/library/bitcoin-and-me/
- Verified: Fetched https://nakamotoinstitute.org/library/bitcoin-and-me/ on 2026-10-22 (library-html, bitcoin-and-me.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 113. Hal Finney (2013)

> I've noticed that cryptographic graybeards (I was in my mid 50's) tend to get cynical.

- Source: Bitcoin and Me
- URL: https://nakamotoinstitute.org/library/bitcoin-and-me/
- Verified: Fetched https://nakamotoinstitute.org/library/bitcoin-and-me/ on 2026-10-22 (library-html, bitcoin-and-me.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 114. Hal Finney (2013)

> The next I heard of Bitcoin was late 2010, when I was surprised to find that it was not only still going, bitcoins actually had monetary value.

- Source: Bitcoin and Me
- URL: https://nakamotoinstitute.org/library/bitcoin-and-me/
- Verified: Fetched https://nakamotoinstitute.org/library/bitcoin-and-me/ on 2026-10-22 (library-html, bitcoin-and-me.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 115. Hal Finney (2013)

> Those discussions about inheriting your bitcoins are of more than academic interest.

- Source: Bitcoin and Me
- URL: https://nakamotoinstitute.org/library/bitcoin-and-me/
- Verified: Fetched https://nakamotoinstitute.org/library/bitcoin-and-me/ on 2026-10-22 (library-html, bitcoin-and-me.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 116. Hal Finney (2013)

> When Satoshi announced Bitcoin on the cryptography mailing list, he got a skeptical reception at best.

- Source: Bitcoin and Me
- URL: https://nakamotoinstitute.org/library/bitcoin-and-me/
- Verified: Fetched https://nakamotoinstitute.org/library/bitcoin-and-me/ on 2026-10-22 (library-html, bitcoin-and-me.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 117. Hal Finney (2013)

> When Satoshi announced the first release of the software, I grabbed it right away.

- Source: Bitcoin and Me
- URL: https://nakamotoinstitute.org/library/bitcoin-and-me/
- Verified: Fetched https://nakamotoinstitute.org/library/bitcoin-and-me/ on 2026-10-22 (library-html, bitcoin-and-me.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 118. Hans-Hermann Hoppe (1994)

> Formerly, with commodity money every person was permitted to enter the gold mining and coining business freely—in accordance with the assumption of self-interested, wealth-maximizing actors.

- Source: How is Fiat Money Possible?—or, The Devolution of Money and Credit
- URL: https://nakamotoinstitute.org/library/how-is-fiat-money-possible/
- Verified: Fetched https://nakamotoinstitute.org/library/how-is-fiat-money-possible/ on 2026-10-22 (library-html, how-is-fiat-money-possible.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 119. Hans-Hermann Hoppe (1994)

> Freedom of contract means instead that A and B should be allowed to make any contract whatsoever regarding their own properties, yet fractional reserve banking involves the making of contracts regarding the property of third parties.

- Source: How is Fiat Money Possible?—or, The Devolution of Money and Credit
- URL: https://nakamotoinstitute.org/library/how-is-fiat-money-possible/
- Verified: Fetched https://nakamotoinstitute.org/library/how-is-fiat-money-possible/ on 2026-10-22 (library-html, how-is-fiat-money-possible.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 120. Hans-Hermann Hoppe (1994)

> Only money proper (gold coins) is permanently suited to perform the function as a medium of exchange.

- Source: How is Fiat Money Possible?—or, The Devolution of Money and Credit
- URL: https://nakamotoinstitute.org/library/how-is-fiat-money-possible/
- Verified: Fetched https://nakamotoinstitute.org/library/how-is-fiat-money-possible/ on 2026-10-22 (library-html, how-is-fiat-money-possible.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 121. Hans-Hermann Hoppe (1994)

> Savers loan money to the bank for a specified—shorter or longer—period of time in exchange for the banks' contractual obligation of future repayment plus some additional interest return.

- Source: How is Fiat Money Possible?—or, The Devolution of Money and Credit
- URL: https://nakamotoinstitute.org/library/how-is-fiat-money-possible/
- Verified: Fetched https://nakamotoinstitute.org/library/how-is-fiat-money-possible/ on 2026-10-22 (library-html, how-is-fiat-money-possible.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 122. Hans-Hermann Hoppe (1994)

> The purchasing power of money will increase, the real value of individual cash balances will be raised, and at a higher purchasing power per unit money, the demand for and the supply of money will once again be equilibrated.

- Source: How is Fiat Money Possible?—or, The Devolution of Money and Credit
- URL: https://nakamotoinstitute.org/library/how-is-fiat-money-possible/
- Verified: Fetched https://nakamotoinstitute.org/library/how-is-fiat-money-possible/ on 2026-10-22 (library-html, how-is-fiat-money-possible.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 123. Hans-Hermann Hoppe (1994)

> The real wealth of the non-bank public will be reduced—they own less goods and more money of lower purchasing power.

- Source: How is Fiat Money Possible?—or, The Devolution of Money and Credit
- URL: https://nakamotoinstitute.org/library/how-is-fiat-money-possible/
- Verified: Fetched https://nakamotoinstitute.org/library/how-is-fiat-money-possible/ on 2026-10-22 (library-html, how-is-fiat-money-possible.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 124. Henry David Thoreau (1854)

> I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived.

- Source: Walden
- URL: https://www.gutenberg.org/files/205/205-0.txt
- Verified: Fetched the Project Gutenberg text of Walden on 2026-10-22. Exact substring after whitespace was collapsed. Public domain.

### 125. Henry David Thoreau (1854)

> Simplify, simplify. Instead of three meals a day, if it be necessary eat but one; instead of a hundred dishes, five; and reduce other things in proportion.

- Source: Walden
- URL: https://www.gutenberg.org/files/205/205-0.txt
- Verified: Fetched the same Gutenberg text. The two sentences are consecutive in the "Where I Lived, and What I Lived For" chapter.

### 126. Henry David Thoreau (1854)

> The mass of men lead lives of quiet desperation.

- Source: Walden
- URL: https://www.gutenberg.org/files/205/205-0.txt
- Verified: Fetched the same Gutenberg text. Exact sentence.

### 127. Ian Grigg (2004)

> A gradual change in contract by the stronger party over time is known as frog-boiling.

- Source: The Ricardian Contract
- URL: https://nakamotoinstitute.org/library/the-ricardian-contract/
- Verified: Fetched https://nakamotoinstitute.org/library/the-ricardian-contract/ on 2026-10-22 (library-html, the-ricardian-contract.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 128. Ian Grigg (2004)

> The first valuable currency, issued by Mark Twain Bank of the USA, was identified with the number 4.

- Source: The Ricardian Contract
- URL: https://nakamotoinstitute.org/library/the-ricardian-contract/
- Verified: Fetched https://nakamotoinstitute.org/library/the-ricardian-contract/ on 2026-10-22 (library-html, the-ricardian-contract.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 129. Ian Grigg (2004)

> The result is a reasonable analogue of the paper and ink contracts that most people and businesses are familiar with, bolstered with cryptographic integrity.

- Source: The Ricardian Contract
- URL: https://nakamotoinstitute.org/library/the-ricardian-contract/
- Verified: Fetched https://nakamotoinstitute.org/library/the-ricardian-contract/ on 2026-10-22 (library-html, the-ricardian-contract.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 130. Ian Grigg (2005)

> As this was more than the contractual issue of value to date, it caused dramatic contortions to the balance sheet, including putting it in breach of its user contract and at dire risk of a 'bank run'.

- Source: Triple Entry Accounting
- URL: https://nakamotoinstitute.org/library/triple-entry-accounting/
- Verified: Fetched https://nakamotoinstitute.org/library/triple-entry-accounting/ on 2026-10-22 (library-html, triple-entry-accounting.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 131. Ian Grigg (2005)

> Paperwork reduces dramatically, as the records of the money system are reliable enough to quickly resolve questions even years after the event.

- Source: Triple Entry Accounting
- URL: https://nakamotoinstitute.org/library/triple-entry-accounting/
- Verified: Fetched https://nakamotoinstitute.org/library/triple-entry-accounting/ on 2026-10-22 (library-html, triple-entry-accounting.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 132. Ian Grigg (2005)

> The cryptographic invention of the digital signature gives powerful evidentiary force to the receipt, and in practice reduces the accounting problem to one of the receipt's presence or its absence.

- Source: Triple Entry Accounting
- URL: https://nakamotoinstitute.org/library/triple-entry-accounting/
- Verified: Fetched https://nakamotoinstitute.org/library/triple-entry-accounting/ on 2026-10-22 (library-html, triple-entry-accounting.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 133. Ian Grigg (2005)

> When a cracker managed to find a flaw in the system, an overnight attack allowed the creation of many millions of dollars worth of value.

- Source: Triple Entry Accounting
- URL: https://nakamotoinstitute.org/library/triple-entry-accounting/
- Verified: Fetched https://nakamotoinstitute.org/library/triple-entry-accounting/ on 2026-10-22 (library-html, triple-entry-accounting.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 134. Jamie Dimon (2017)

> is a fraud

- Source: CNBC: Jamie Dimon says bitcoin is a fraud
- URL: https://www.cnbc.com/2017/09/12/jpmorgan-ceo-jamie-dimon-raises-flag-on-trading-revenue-sees-20-percent-fall-for-the-third-quarter.html
- Verified: Fetched the same CNBC article. The words inside the quotation marks are "is a fraud." The reporter's frame ("saying the cryptocurrency") is not included.

### 135. Jamie Dimon (2017)

> It's just not a real thing, eventually it will be closed,

- Source: CNBC: Jamie Dimon says bitcoin is a fraud
- URL: https://www.cnbc.com/2017/09/12/jpmorgan-ceo-jamie-dimon-raises-flag-on-trading-revenue-sees-20-percent-fall-for-the-third-quarter.html
- Verified: Fetched the same CNBC article. Dimon is quoted: "It's just not a real thing, eventually it will be closed." The article also reports he said the cryptocurrency "is a fraud."

### 136. Jamie Dimon (2017)

> It's worse than tulip bulbs. It won't end well. Someone is going to get killed,

- Source: CNBC: Jamie Dimon says bitcoin is a fraud
- URL: https://www.cnbc.com/2017/09/12/jpmorgan-ceo-jamie-dimon-raises-flag-on-trading-revenue-sees-20-percent-fall-for-the-third-quarter.html
- Verified: Fetched the CNBC article (12 Sep 2017) on 2026-10-22. The article quotes Dimon: "It's worse than tulip bulbs. It won't end well. Someone is going to get killed."

### 137. John Perry Barlow (1996)

> Governments of the Industrial World, you weary giants of flesh and steel, I come from Cyberspace, the new home of Mind.

- Source: A Declaration of the Independence of Cyberspace
- URL: https://nakamotoinstitute.org/library/cyberspace-independence/
- Verified: Fetched https://nakamotoinstitute.org/library/cyberspace-independence/ on 2026-10-22 (library-html, cyberspace-independence.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 138. John Perry Barlow (1996)

> The only law that all our constituent cultures would generally recognize is the Golden Rule.

- Source: A Declaration of the Independence of Cyberspace
- URL: https://nakamotoinstitute.org/library/cyberspace-independence/
- Verified: Fetched https://nakamotoinstitute.org/library/cyberspace-independence/ on 2026-10-22 (library-html, cyberspace-independence.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 139. John Perry Barlow (1996)

> We have no elected government, nor are we likely to have one, so I address you with no greater authority than that with which liberty itself always speaks.

- Source: A Declaration of the Independence of Cyberspace
- URL: https://nakamotoinstitute.org/library/cyberspace-independence/
- Verified: Fetched https://nakamotoinstitute.org/library/cyberspace-independence/ on 2026-10-22 (library-html, cyberspace-independence.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 140. John Perry Barlow (1996)

> You do not know our culture, our ethics, or the unwritten codes that already provide our society more order than could be obtained by any of your impositions.

- Source: A Declaration of the Independence of Cyberspace
- URL: https://nakamotoinstitute.org/library/cyberspace-independence/
- Verified: Fetched https://nakamotoinstitute.org/library/cyberspace-independence/ on 2026-10-22 (library-html, cyberspace-independence.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 141. John Perry Barlow (1996)

> You have no moral right to rule us nor do you possess any methods of enforcement we have true reason to fear.

- Source: A Declaration of the Independence of Cyberspace
- URL: https://nakamotoinstitute.org/library/cyberspace-independence/
- Verified: Fetched https://nakamotoinstitute.org/library/cyberspace-independence/ on 2026-10-22 (library-html, cyberspace-independence.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 142. John Perry Barlow (1996)

> You have not engaged in our great and gathering conversation, nor did you create the wealth of our marketplaces.

- Source: A Declaration of the Independence of Cyberspace
- URL: https://nakamotoinstitute.org/library/cyberspace-independence/
- Verified: Fetched https://nakamotoinstitute.org/library/cyberspace-independence/ on 2026-10-22 (library-html, cyberspace-independence.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 143. Jörg Guido Hülsmann (2008)

> In practice the redistribution always works out in favor of the fiat-money producers themselves (whom we misleadingly call "central banks") and of their partners in the banking sector and at the stock exchange.

- Source: Deflation and Liberty
- URL: https://cdn.nakamotoinstitute.org/docs/deflation-and-liberty.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/deflation-and-liberty.pdf on 2026-10-22 (pdf, deflation-and-liberty.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 144. Jörg Guido Hülsmann (2008)

> Paper money has caused an unprecedented increase of debt on all levels: government, corporate, and individual.

- Source: Deflation and Liberty
- URL: https://cdn.nakamotoinstitute.org/docs/deflation-and-liberty.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/deflation-and-liberty.pdf on 2026-10-22 (pdf, deflation-and-liberty.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 145. Jörg Guido Hülsmann (2008)

> The point is that other people will run the firms and own the houses—people who at the time the deflation set in were out of debt and had cash in their hands to buy firms and real estate.

- Source: Deflation and Liberty
- URL: https://cdn.nakamotoinstitute.org/docs/deflation-and-liberty.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/deflation-and-liberty.pdf on 2026-10-22 (pdf, deflation-and-liberty.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 146. Jörg Guido Hülsmann (2008)

> The production of any quantity of paper money is therefore excessive by the standards of a free society.

- Source: Deflation and Liberty
- URL: https://cdn.nakamotoinstitute.org/docs/deflation-and-liberty.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/deflation-and-liberty.pdf on 2026-10-22 (pdf, deflation-and-liberty.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 147. Jörg Guido Hülsmann (2008)

> They can support a policy designed to perpetuate our current fiat money system and the sorry state of banking and of financial markets that it logically entails.

- Source: Deflation and Liberty
- URL: https://cdn.nakamotoinstitute.org/docs/deflation-and-liberty.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/deflation-and-liberty.pdf on 2026-10-22 (pdf, deflation-and-liberty.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 148. Jörg Guido Hülsmann (2008)

> They enable the producers of paper money and of money titles to expand their production through the violation of other people's property rights.

- Source: Deflation and Liberty
- URL: https://cdn.nakamotoinstitute.org/docs/deflation-and-liberty.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/deflation-and-liberty.pdf on 2026-10-22 (pdf, deflation-and-liberty.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 149. Julian Assange (2006)

> Authoritarian regimes create forces which oppose them by pushing against a people's will to truth, love and self-realization.

- Source: State and Terrorist Conspiracies
- URL: https://cdn.nakamotoinstitute.org/docs/julian-assange-conspiracies.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/julian-assange-conspiracies.pdf on 2026-10-22 (pdf, julian-assange-conspiracies.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 150. Julian Assange (2006)

> Authoritarian regimes give rise to forces which oppose them by pushing against the individual and collective will to freedom, truth and self realization.

- Source: State and Terrorist Conspiracies
- URL: https://cdn.nakamotoinstitute.org/docs/julian-assange-conspiracies.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/julian-assange-conspiracies.pdf on 2026-10-22 (pdf, julian-assange-conspiracies.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 151. Ken Thompson (1984)

> You can't trust code that you did not totally create yourself. (Especially code from companies that employ people like me.) No amount of source-level verification or scrutiny will protect you from using untrusted code.

- Source: Reflections on Trusting Trust
- URL: https://cdn.nakamotoinstitute.org/docs/reflections-on-trusting-trust.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/reflections-on-trusting-trust.pdf on 2026-10-22 (pdf, reflections-on-trusting-trust.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 152. Ludwig von Mises (1949)

> The alternative is only whether the crisis should come sooner as the result of a voluntary abandonment of further credit expansion, or later as a final and total catastrophe of the currency system involved.

- Source: Human Action
- URL: https://cdn.mises.org/Human%20Action_3.pdf
- Verified: Fetched https://cdn.mises.org/Human%20Action_3.pdf on 2026-10-22 and extracted text with pdftotext. Line breaks were joined. The famous preceding sentence is garbled in this scan ("finaI colfapse") and was not corrected into a quote. This following sentence is clean and matches.

### 153. Lyn Alden (2022)

> Bitcoin is a tool that tech-savvy people often use as defense against either double digit currency inflation or authoritarian financial system control.

- Source: What is Money?
- URL: https://www.lynalden.com/what-is-money/
- Verified: Fetched https://www.lynalden.com/what-is-money/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 154. Lyn Alden (2022)

> In other words, like gold, they are money rather than currency, as long as other people recognize them as having value.

- Source: What is Money?
- URL: https://www.lynalden.com/what-is-money/
- Verified: Fetched https://www.lynalden.com/what-is-money/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 155. Lyn Alden (2022)

> In that sense, bitcoins began as digital commodities that had utility value as an internet-native and censorship-resistant medium of exchange for people that need that capability.

- Source: What is Money?
- URL: https://www.lynalden.com/what-is-money/
- Verified: Fetched https://www.lynalden.com/what-is-money/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 156. Lyn Alden (2022)

> The base layer of the bitcoin network is not competing with things like Visa; it is competing with central bank settlements; the root of the global financial system.

- Source: What is Money?
- URL: https://www.lynalden.com/what-is-money/
- Verified: Fetched https://www.lynalden.com/what-is-money/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 157. Lyn Alden (2022)

> The bitcoin network consists of people using free open source software to update a public ledger between themselves.

- Source: What is Money?
- URL: https://www.lynalden.com/what-is-money/
- Verified: Fetched https://www.lynalden.com/what-is-money/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 158. Lyn Alden (2022)

> The fiat/petrodollar standard is only four times older than bitcoin, and only two times older than the first internet browser.

- Source: What is Money?
- URL: https://www.lynalden.com/what-is-money/
- Verified: Fetched https://www.lynalden.com/what-is-money/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 159. Lyn Alden (2022)

> The Guardian has documented Nigerians using bitcoins as they protested their government against police violence and had their bank accounts frozen.

- Source: What is Money?
- URL: https://www.lynalden.com/what-is-money/
- Verified: Fetched https://www.lynalden.com/what-is-money/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 160. Lyn Alden (2022)

> There are decentralized bearer assets like bitcoins, and there are digital representations of fiat currency like corporate stablecoins and central bank digital currencies.

- Source: What is Money?
- URL: https://www.lynalden.com/what-is-money/
- Verified: Fetched https://www.lynalden.com/what-is-money/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 161. Marty Bent (2023)

> Bitcoin is an empowering tool that gives each of us a voice and a path to opt in to a more stable economic system.

- Source: Gradually, Then Suddenly: Foreword
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/foreword/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/foreword/ on 2026-10-22 (gts, foreword.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 162. Marty Bent (2023)

> Everyone who adopts bitcoin---whether to save wealth or conduct commerce---is at the same time expressing both a vote of confidence in its monetary principles and a vote of no confidence in the fiat monetary system.

- Source: Gradually, Then Suddenly: Foreword
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/foreword/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/foreword/ on 2026-10-22 (gts, foreword.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 163. Marty Bent (2023)

> There was always a new, "shinier" object that had improved (supposedly) on bitcoin's original design to bring the market what it actually needed.

- Source: Gradually, Then Suddenly: Foreword
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/foreword/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/foreword/ on 2026-10-22 (gts, foreword.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 164. Marty Bent (2023)

> There were people saying that bitcoin would not work because the government would never allow it.

- Source: Gradually, Then Suddenly: Foreword
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/foreword/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/foreword/ on 2026-10-22 (gts, foreword.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 165. Michael Saylor (2022)

> It's easier to confiscate things in the real world than things in cyberspace, much easier.

- Source: Lex Fridman Podcast #276 transcript
- URL: https://lexfridman.com/michael-saylor-transcript/
- Verified: Fetched the same transcript. Spoken by Michael Saylor at the 01:49:32 timestamp, not by the host.

### 166. Michael Saylor (2022)

> The most famous manifestation of digital energy is Bitcoin.

- Source: Lex Fridman Podcast #276 transcript
- URL: https://lexfridman.com/michael-saylor-transcript/
- Verified: Fetched the Lex Fridman transcript on 2026-10-22. The line is under the Michael Saylor timestamp. The interview discusses 2022 as the current year.

### 167. Michael Saylor (2022)

> Yeah, I think it keeps going up forever.

- Source: Lex Fridman Podcast #276 transcript
- URL: https://lexfridman.com/michael-saylor-transcript/
- Verified: Fetched the same transcript. This sentence is his (03:03:24). The following price guess was not included.

### 168. Murray N. Rothbard (1963)

> Government could never cement its power over a nation's currency, if the people, when in need, could repudiate the fiat paper and turn to gold for their money.

- Source: What Has Government Done to Our Money?
- URL: https://cdn.nakamotoinstitute.org/docs/what-has-government-done-to-our-money.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/what-has-government-done-to-our-money.pdf on 2026-10-22 (pdf, what-has-government-done-to-our-money.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 169. Murray N. Rothbard (1963)

> Government imposes price controls largely in order to divert public attention from governmental inflation to the alleged evils of the free market.

- Source: What Has Government Done to Our Money?
- URL: https://cdn.nakamotoinstitute.org/docs/what-has-government-done-to-our-money.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/what-has-government-done-to-our-money.pdf on 2026-10-22 (pdf, what-has-government-done-to-our-money.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 170. Murray N. Rothbard (1963)

> If there are 3,000 tons of gold in the society, all 3,000 tons must be owned and held, at any one time, in the cash balances of individual people.

- Source: What Has Government Done to Our Money?
- URL: https://cdn.nakamotoinstitute.org/docs/what-has-government-done-to-our-money.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/what-has-government-done-to-our-money.pdf on 2026-10-22 (pdf, what-has-government-done-to-our-money.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 171. Murray N. Rothbard (1963)

> The international gold standard provided an automatic market mechanism for checking the inflationary potential of government.

- Source: What Has Government Done to Our Money?
- URL: https://cdn.nakamotoinstitute.org/docs/what-has-government-done-to-our-money.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/what-has-government-done-to-our-money.pdf on 2026-10-22 (pdf, what-has-government-done-to-our-money.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 172. Murray N. Rothbard (1963)

> The law really says that "money overvalued artificially by government will drive out of circulation artificially undervalued money." Suppose, for example, there are one-ounce gold coins in circulation.

- Source: What Has Government Done to Our Money?
- URL: https://cdn.nakamotoinstitute.org/docs/what-has-government-done-to-our-money.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/what-has-government-done-to-our-money.pdf on 2026-10-22 (pdf, what-has-government-done-to-our-money.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 173. Murray N. Rothbard (1963)

> The more people use actual gold instead of bank money, the less room there is for bank inflation.

- Source: What Has Government Done to Our Money?
- URL: https://cdn.nakamotoinstitute.org/docs/what-has-government-done-to-our-money.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/what-has-government-done-to-our-money.pdf on 2026-10-22 (pdf, what-has-government-done-to-our-money.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 174. Murray N. Rothbard (1963)

> The United States would no longer try to keep the free-market gold price at $35; it would ignore the free gold market, and it and all the other governments agreed to keep the value of the dollar at $35 an ounce forevermore.

- Source: What Has Government Done to Our Money?
- URL: https://cdn.nakamotoinstitute.org/docs/what-has-government-done-to-our-money.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/what-has-government-done-to-our-money.pdf on 2026-10-22 (pdf, what-has-government-done-to-our-money.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 175. Murray N. Rothbard (1963)

> True to the virtual law that all innovations come from free individuals and not the state, the first coins were minted by private individuals and goldsmiths.

- Source: What Has Government Done to Our Money?
- URL: https://cdn.nakamotoinstitute.org/docs/what-has-government-done-to-our-money.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/what-has-government-done-to-our-money.pdf on 2026-10-22 (pdf, what-has-government-done-to-our-money.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 176. Murray N. Rothbard (1963)

> We have seen that, by setting up a Central Bank, governments have greatly widened, if not removed, two of the three main checks on bank credit inflation.

- Source: What Has Government Done to Our Money?
- URL: https://cdn.nakamotoinstitute.org/docs/what-has-government-done-to-our-money.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/what-has-government-done-to-our-money.pdf on 2026-10-22 (pdf, what-has-government-done-to-our-money.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 177. Murray N. Rothbard (1963)

> When legal tender laws enshrine an overvalued money, they have another effect; they favor debtors at the expense of creditors.

- Source: What Has Government Done to Our Money?
- URL: https://cdn.nakamotoinstitute.org/docs/what-has-government-done-to-our-money.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/what-has-government-done-to-our-money.pdf on 2026-10-22 (pdf, what-has-government-done-to-our-money.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 178. Murray N. Rothbard (1963)

> When the Central Bank sells assets to the banks or the public, it lowers bank reserves, and causes pressure for credit contraction and deflation—lowering—of the money supply.

- Source: What Has Government Done to Our Money?
- URL: https://cdn.nakamotoinstitute.org/docs/what-has-government-done-to-our-money.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/what-has-government-done-to-our-money.pdf on 2026-10-22 (pdf, what-has-government-done-to-our-money.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 179. Murray N. Rothbard (1963)

> With fiat money established and gold outlawed, the way is clear for full-scale, government-run inflation.

- Source: What Has Government Done to Our Money?
- URL: https://cdn.nakamotoinstitute.org/docs/what-has-government-done-to-our-money.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/what-has-government-done-to-our-money.pdf on 2026-10-22 (pdf, what-has-government-done-to-our-money.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 180. Murray N. Rothbard (1983)

> A rash of bank runs will bring the insolvency of many banks and deflationary contraction of credit and the money supply.

- Source: The Mystery of Banking
- URL: https://cdn.nakamotoinstitute.org/docs/the-mystery-of-banking.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/the-mystery-of-banking.pdf on 2026-10-22 (pdf, the-mystery-of-banking.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 181. Murray N. Rothbard (1983)

> After that point, each bank will have 100 percent reserve of gold, so that a law holding fractional reserve banking as fraud and enforcing 100 percent reserve would not entail any deflation or contraction of the money supply.

- Source: The Mystery of Banking
- URL: https://cdn.nakamotoinstitute.org/docs/the-mystery-of-banking.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/the-mystery-of-banking.pdf on 2026-10-22 (pdf, the-mystery-of-banking.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 182. Murray N. Rothbard (1983)

> Government fiat paper has replaced commodity money, and central banking has taken the place of free banking.

- Source: The Mystery of Banking
- URL: https://cdn.nakamotoinstitute.org/docs/the-mystery-of-banking.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/the-mystery-of-banking.pdf on 2026-10-22 (pdf, the-mystery-of-banking.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 183. Murray N. Rothbard (1983)

> If people in general have the wise and prudent attitudes of many "primitive" tribesmen and refuse to accept anything but hard gold coin in exchange, bank money will not get under way or wreak inflationary havoc on the economy.

- Source: The Mystery of Banking
- URL: https://cdn.nakamotoinstitute.org/docs/the-mystery-of-banking.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/the-mystery-of-banking.pdf on 2026-10-22 (pdf, the-mystery-of-banking.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 184. Murray N. Rothbard (1983)

> In a free market, gold and silver each would be free to become money and would float freely in relation to each other ("parallel standards").

- Source: The Mystery of Banking
- URL: https://cdn.nakamotoinstitute.org/docs/the-mystery-of-banking.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/the-mystery-of-banking.pdf on 2026-10-22 (pdf, the-mystery-of-banking.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 185. Murray N. Rothbard (1983)

> In contrast, the essential purpose of central banking is to use government privilege to remove the limitations placed by free banking on monetary and bank credit inflation.

- Source: The Mystery of Banking
- URL: https://cdn.nakamotoinstitute.org/docs/the-mystery-of-banking.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/the-mystery-of-banking.pdf on 2026-10-22 (pdf, the-mystery-of-banking.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 186. Murray N. Rothbard (1983)

> The dollar remained on the gold standard internationally, with dollars redeemable to foreign governments and central banks at the newly debased weight.

- Source: The Mystery of Banking
- URL: https://cdn.nakamotoinstitute.org/docs/the-mystery-of-banking.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/the-mystery-of-banking.pdf on 2026-10-22 (pdf, the-mystery-of-banking.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 187. Murray N. Rothbard (1983)

> Then, if A has contracted with B for a debt of $10,000 in money, B has to accept payment in Central Bank notes; he cannot insist, for example, on gold.

- Source: The Mystery of Banking
- URL: https://cdn.nakamotoinstitute.org/docs/the-mystery-of-banking.pdf
- Verified: Fetched https://cdn.nakamotoinstitute.org/docs/the-mystery-of-banking.pdf on 2026-10-22 (pdf, the-mystery-of-banking.txt). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 188. Nick Szabo (1994)

> A smart contract is a computerized transaction protocol that executes the terms of a contract.

- Source: Smart Contracts
- URL: https://nakamotoinstitute.org/library/smart-contracts/
- Verified: Fetched https://nakamotoinstitute.org/library/smart-contracts/ on 2026-10-22 (library-html, smart-contracts.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 189. Nick Szabo (1994)

> If a loan was taken out to buy that car, and the owner failed to make payments, the smart contract could automatically invoke a lien, which returns control of the car keys to the bank.

- Source: Smart Contracts
- URL: https://nakamotoinstitute.org/library/smart-contracts/
- Verified: Fetched https://nakamotoinstitute.org/library/smart-contracts/ on 2026-10-22 (library-html, smart-contracts.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 190. Nick Szabo (1994)

> It might be possible to add smart contract protocols to transfer voting rights to the synthetic.

- Source: Smart Contracts
- URL: https://nakamotoinstitute.org/library/smart-contracts/
- Verified: Fetched https://nakamotoinstitute.org/library/smart-contracts/ on 2026-10-22 (library-html, smart-contracts.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 191. Nick Szabo (1994)

> Smart property might be created by embedding smart contracts in physical objects.

- Source: Smart Contracts
- URL: https://nakamotoinstitute.org/library/smart-contracts/
- Verified: Fetched https://nakamotoinstitute.org/library/smart-contracts/ on 2026-10-22 (library-html, smart-contracts.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 192. Nick Szabo (1994)

> The consequences of smart contract design on contract law and economics, and on strategic contract drafting, (and vice versa), have been little explored.

- Source: Smart Contracts
- URL: https://nakamotoinstitute.org/library/smart-contracts/
- Verified: Fetched https://nakamotoinstitute.org/library/smart-contracts/ on 2026-10-22 (library-html, smart-contracts.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 193. Nick Szabo (1996)

> A mediator must be trusted with some of the contents and/or performance of the contract.

- Source: Smart Contracts: Building Blocks for Digital Markets
- URL: https://nakamotoinstitute.org/library/smart-contracts-building-blocks-for-digital-markets/
- Verified: Fetched https://nakamotoinstitute.org/library/smart-contracts-building-blocks-for-digital-markets/ on 2026-10-22 (library-html, smart-contracts-building-blocks-for-digital-markets.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 194. Nick Szabo (1996)

> If we started from scratch, using reason and experience, it could take many centuries to redevelop sophisticated ideas like property rights that make the modern free market work (see Hayek).

- Source: Smart Contracts: Building Blocks for Digital Markets
- URL: https://nakamotoinstitute.org/library/smart-contracts-building-blocks-for-digital-markets/
- Verified: Fetched https://nakamotoinstitute.org/library/smart-contracts-building-blocks-for-digital-markets/ on 2026-10-22 (library-html, smart-contracts-building-blocks-for-digital-markets.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 195. Nick Szabo (1996)

> On the other hand, credit transactions typically demand identifying information, because the contractual exposure typically outweighs benefits of privity.

- Source: Negative Reputations
- URL: https://nakamotoinstitute.org/library/negative-reputations/
- Verified: Fetched https://nakamotoinstitute.org/library/negative-reputations/ on 2026-10-22 (library-html, negative-reputations.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 196. Nick Szabo (1996)

> The current universal (non-cryptographic) key in the U.S., the SSN, is very difficult to revoke.

- Source: Negative Reputations
- URL: https://nakamotoinstitute.org/library/negative-reputations/
- Verified: Fetched https://nakamotoinstitute.org/library/negative-reputations/ on 2026-10-22 (library-html, negative-reputations.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 197. Nick Szabo (1996)

> The public key cryptography software package "Pretty Good Privacy" (PGP) uses a model called "the web of trust." Alice chooses introducers whom she trusts to properly identify the map between other people and their public keys.

- Source: Smart Contracts: Building Blocks for Digital Markets
- URL: https://nakamotoinstitute.org/library/smart-contracts-building-blocks-for-digital-markets/
- Verified: Fetched https://nakamotoinstitute.org/library/smart-contracts-building-blocks-for-digital-markets/ on 2026-10-22 (library-html, smart-contracts-building-blocks-for-digital-markets.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 198. Nick Szabo (1996)

> The tag might be used for negative information shared publically (eg, credit ratings) or kept private (eg, kill files).

- Source: Negative Reputations
- URL: https://nakamotoinstitute.org/library/negative-reputations/
- Verified: Fetched https://nakamotoinstitute.org/library/negative-reputations/ on 2026-10-22 (library-html, negative-reputations.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 199. Nick Szabo (1996)

> Whether enforced by a government, or otherwise, the contract is the basic building block of a free market economy.

- Source: Smart Contracts: Building Blocks for Digital Markets
- URL: https://nakamotoinstitute.org/library/smart-contracts-building-blocks-for-digital-markets/
- Verified: Fetched https://nakamotoinstitute.org/library/smart-contracts-building-blocks-for-digital-markets/ on 2026-10-22 (library-html, smart-contracts-building-blocks-for-digital-markets.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 200. Nick Szabo (1997)

> A security system, by successive redesign, increasingly approaches the logic of the contract which governs the rights and obligations covering the object, information, or computation being secured.

- Source: The Idea of Smart Contracts
- URL: https://nakamotoinstitute.org/library/the-idea-of-smart-contracts/
- Verified: Fetched https://nakamotoinstitute.org/library/the-idea-of-smart-contracts/ on 2026-10-22 (library-html, the-idea-of-smart-contracts.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 201. Nick Szabo (1997)

> Alice wants a New York City cab ride for which she's willing to pay 100, but she doesn't trust Bob the taxi driver to get her there on time if she pays up front.

- Source: Formalizing and Securing Relationships on Public Networks
- URL: https://nakamotoinstitute.org/library/formalizing-securing-relationships/
- Verified: Fetched https://nakamotoinstitute.org/library/formalizing-securing-relationships/ on 2026-10-22 (library-html, formalizing-securing-relationships.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 202. Nick Szabo (1997)

> If we started from scratch, using reason and experience, it could take many centuries to redevelop sophisticated ideas like contract law and property rights that make the modern market work.

- Source: Formalizing and Securing Relationships on Public Networks
- URL: https://nakamotoinstitute.org/library/formalizing-securing-relationships/
- Verified: Fetched https://nakamotoinstitute.org/library/formalizing-securing-relationships/ on 2026-10-22 (library-html, formalizing-securing-relationships.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 203. Nick Szabo (1997)

> Many kinds of contractual clauses (such as collateral, bonding, delineation of property rights, etc.) can be embedded in the hardware and software we deal with, in such a way as to make breach of contract expensive (if desired, sometimes prohibitively so) for the breacher.

- Source: The Idea of Smart Contracts
- URL: https://nakamotoinstitute.org/library/the-idea-of-smart-contracts/
- Verified: Fetched https://nakamotoinstitute.org/library/the-idea-of-smart-contracts/ on 2026-10-22 (library-html, the-idea-of-smart-contracts.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 204. Nick Szabo (1997)

> The fixed price at the supermarket (instead of haggling), the prewritten contract the appliance salesman presents you, etc. are examples of hard focal points.

- Source: Formalizing and Securing Relationships on Public Networks
- URL: https://nakamotoinstitute.org/library/formalizing-securing-relationships/
- Verified: Fetched https://nakamotoinstitute.org/library/formalizing-securing-relationships/ on 2026-10-22 (library-html, formalizing-securing-relationships.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 205. Nick Szabo (1997)

> The radical SPU projects demonstrate both the high value of content contracts to publishers and the high price we have to pay to maintain the paper-era intellectual property model online.

- Source: Formalizing and Securing Relationships on Public Networks
- URL: https://nakamotoinstitute.org/library/formalizing-securing-relationships/
- Verified: Fetched https://nakamotoinstitute.org/library/formalizing-securing-relationships/ on 2026-10-22 (library-html, formalizing-securing-relationships.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 206. Nick Szabo (1997)

> The smart contract design strategy suggests that we successively refine security protocols to more fully embed in a property the contractual terms which deal with it.

- Source: The Idea of Smart Contracts
- URL: https://nakamotoinstitute.org/library/the-idea-of-smart-contracts/
- Verified: Fetched https://nakamotoinstitute.org/library/the-idea-of-smart-contracts/ on 2026-10-22 (library-html, the-idea-of-smart-contracts.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 207. Nick Szabo (1997)

> The vending machine is a contract with bearer: anybody with coins can participate in an exchange with the vendor.

- Source: Formalizing and Securing Relationships on Public Networks
- URL: https://nakamotoinstitute.org/library/formalizing-securing-relationships/
- Verified: Fetched https://nakamotoinstitute.org/library/formalizing-securing-relationships/ on 2026-10-22 (library-html, formalizing-securing-relationships.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 208. Nick Szabo (1997)

> Under this model privacy and confidentiality, or protecting the value of information about a contract, its parties, and its performance from Eve, is subsumed under privity, as are property rights.

- Source: Formalizing and Securing Relationships on Public Networks
- URL: https://nakamotoinstitute.org/library/formalizing-securing-relationships/
- Verified: Fetched https://nakamotoinstitute.org/library/formalizing-securing-relationships/ on 2026-10-22 (library-html, formalizing-securing-relationships.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 209. Nick Szabo (1998)

> Actually getting end users to respect the property rights agreed upon by this system will be dependent on the specific nature of the property, and is beyond the scope of the current inquiry.

- Source: Secure Property Titles with Owner Authority
- URL: https://nakamotoinstitute.org/library/secure-property-titles/
- Verified: Fetched https://nakamotoinstitute.org/library/secure-property-titles/ on 2026-10-22 (library-html, secure-property-titles.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 210. Nick Szabo (1998)

> Eventually, the thugs, mechanisms, or informal agreements which enforce property rights converge on a particular tree as the standard, proper allocation.

- Source: Secure Property Titles with Owner Authority
- URL: https://nakamotoinstitute.org/library/secure-property-titles/
- Verified: Fetched https://nakamotoinstitute.org/library/secure-property-titles/ on 2026-10-22 (library-html, secure-property-titles.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 211. Nick Szabo (1998)

> In all cases of property rights there is a defined space, whether a namespace or physical space, and the task is to agree on simple attributes of or rights to control subdivisions of that space.

- Source: Secure Property Titles with Owner Authority
- URL: https://nakamotoinstitute.org/library/secure-property-titles/
- Verified: Fetched https://nakamotoinstitute.org/library/secure-property-titles/ on 2026-10-22 (library-html, secure-property-titles.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 212. Nick Szabo (1998)

> The advent of writing greatly improved the tracking of property rights, and indeed gave rise to our modern systems of property rights and law.

- Source: Secure Property Titles with Owner Authority
- URL: https://nakamotoinstitute.org/library/secure-property-titles/
- Verified: Fetched https://nakamotoinstitute.org/library/secure-property-titles/ on 2026-10-22 (library-html, secure-property-titles.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 213. Nick Szabo (1998)

> The property club can be thought of as a "microgovernment", an entity that performs globally and independently one narrow function normally associated with government.

- Source: Secure Property Titles with Owner Authority
- URL: https://nakamotoinstitute.org/library/secure-property-titles/
- Verified: Fetched https://nakamotoinstitute.org/library/secure-property-titles/ on 2026-10-22 (library-html, secure-property-titles.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 214. Nick Szabo (1999)

> A basic requirement for market pricing to work is that both sides to a transaction be able to map charges to value obtained or rendered, so that they can adjust their buying or selling behavior accordingly.

- Source: Micropayments and Mental Transaction Costs
- URL: https://nakamotoinstitute.org/library/micropayments-and-mental-transaction-costs/
- Verified: Fetched https://nakamotoinstitute.org/library/micropayments-and-mental-transaction-costs/ on 2026-10-22 (library-html, micropayments-and-mental-transaction-costs.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 215. Nick Szabo (1999)

> A big task is to use the power of graphical user interface to come up with new metaphors to make this easier.

- Source: Micropayments and Mental Transaction Costs
- URL: https://nakamotoinstitute.org/library/micropayments-and-mental-transaction-costs/
- Verified: Fetched https://nakamotoinstitute.org/library/micropayments-and-mental-transaction-costs/ on 2026-10-22 (library-html, micropayments-and-mental-transaction-costs.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 216. Nick Szabo (1999)

> A framework of mental transaction costs and price granularity is then presented, and arguments ab out micropayments recast in its light.

- Source: Micropayments and Mental Transaction Costs
- URL: https://nakamotoinstitute.org/library/micropayments-and-mental-transaction-costs/
- Verified: Fetched https://nakamotoinstitute.org/library/micropayments-and-mental-transaction-costs/ on 2026-10-22 (library-html, micropayments-and-mental-transaction-costs.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 217. Nick Szabo (1999)

> Another intriguing possibility is that the virtual computer can keep state over long periods of time, allowing sophisticated forms of privy and self-enforcing secured credit.

- Source: The God Protocols
- URL: https://nakamotoinstitute.org/library/the-god-protocols/
- Verified: Fetched https://nakamotoinstitute.org/library/the-god-protocols/ on 2026-10-22 (library-html, the-god-protocols.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 218. Nick Szabo (1999)

> Applying this kind of analysis to the performance phase of contracts is less straightforward.

- Source: The God Protocols
- URL: https://nakamotoinstitute.org/library/the-god-protocols/
- Verified: Fetched https://nakamotoinstitute.org/library/the-god-protocols/ on 2026-10-22 (library-html, the-god-protocols.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 219. Nick Szabo (1999)

> Enough instances of a standardized contract are issued over a period of time to create a mix.

- Source: Contracts with Bearer
- URL: https://nakamotoinstitute.org/library/contracts-with-bearer/
- Verified: Fetched https://nakamotoinstitute.org/library/contracts-with-bearer/ on 2026-10-22 (library-html, contracts-with-bearer.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 220. Nick Szabo (1999)

> Here is another example of a generic right, or class of fungible objects: "A queriable SQL database with up to 10 MB of storage, and certain standard response time guarantees".

- Source: Contracts with Bearer
- URL: https://nakamotoinstitute.org/library/contracts-with-bearer/
- Verified: Fetched https://nakamotoinstitute.org/library/contracts-with-bearer/ on 2026-10-22 (library-html, contracts-with-bearer.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 221. Nick Szabo (1999)

> In traditional results, fairness and privacy could not both be achieved with a faulty majority.

- Source: The God Protocols
- URL: https://nakamotoinstitute.org/library/the-god-protocols/
- Verified: Fetched https://nakamotoinstitute.org/library/the-god-protocols/ on 2026-10-22 (library-html, the-god-protocols.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 222. Nick Szabo (1999)

> People tend to think in terms of standard or sterotyped conditions: payment in dollars, investing in stocks, etc. when there exist a far wider variety of alternative contractial structures that, combined properly, could better meet the parties' needs.

- Source: Micropayments and Mental Transaction Costs
- URL: https://nakamotoinstitute.org/library/micropayments-and-mental-transaction-costs/
- Verified: Fetched https://nakamotoinstitute.org/library/micropayments-and-mental-transaction-costs/ on 2026-10-22 (library-html, micropayments-and-mental-transaction-costs.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 223. Nick Szabo (1999)

> The second is that there is a tradeoff between privacy, fairness, and fault tolerance.

- Source: The God Protocols
- URL: https://nakamotoinstitute.org/library/the-god-protocols/
- Verified: Fetched https://nakamotoinstitute.org/library/the-god-protocols/ on 2026-10-22 (library-html, the-god-protocols.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 224. Nick Szabo (1999)

> The two main goals here are to assure that users can verify their rights (including exclusivity from transferors where promised) and retain full privacy from TAs and Providers.

- Source: Contracts with Bearer
- URL: https://nakamotoinstitute.org/library/contracts-with-bearer/
- Verified: Fetched https://nakamotoinstitute.org/library/contracts-with-bearer/ on 2026-10-22 (library-html, contracts-with-bearer.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 225. Nick Szabo (1999)

> They trade robustness for privacy and fairness against any proportion of faulty parties.

- Source: The God Protocols
- URL: https://nakamotoinstitute.org/library/the-god-protocols/
- Verified: Fetched https://nakamotoinstitute.org/library/the-god-protocols/ on 2026-10-22 (library-html, the-god-protocols.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 226. Nick Szabo (1999)

> When technologists talk about transaction costs, they are usually talking about computation and network costs.

- Source: Micropayments and Mental Transaction Costs
- URL: https://nakamotoinstitute.org/library/micropayments-and-mental-transaction-costs/
- Verified: Fetched https://nakamotoinstitute.org/library/micropayments-and-mental-transaction-costs/ on 2026-10-22 (library-html, micropayments-and-mental-transaction-costs.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 227. Nick Szabo (2001)

> A corollary of "trusted third parties are security holes" is "all security protocols have security holes", since no protocol is fully free of such assumptions.

- Source: Trusted Third Parties are Security Holes
- URL: https://nakamotoinstitute.org/library/trusted-third-parties/
- Verified: Fetched https://nakamotoinstitute.org/library/trusted-third-parties/ on 2026-10-22 (library-html, trusted-third-parties.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 228. Nick Szabo (2001)

> Another protocol family in which trust can be distributed to preserve privacy is the multiparty private computations.

- Source: Trusted Third Parties are Security Holes
- URL: https://nakamotoinstitute.org/library/trusted-third-parties/
- Verified: Fetched https://nakamotoinstitute.org/library/trusted-third-parties/ on 2026-10-22 (library-html, trusted-third-parties.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 229. Nick Szabo (2001)

> Applications include secure name registries and property titles as well as securely published content in Mojo Nation and Freenet.

- Source: Trusted Third Parties are Security Holes
- URL: https://nakamotoinstitute.org/library/trusted-third-parties/
- Verified: Fetched https://nakamotoinstitute.org/library/trusted-third-parties/ on 2026-10-22 (library-html, trusted-third-parties.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 230. Nick Szabo (2001)

> Commercial security is a matter of solving the practical problems of business relationships such as privacy, integrity, protecting property, or detecting breach of contract.

- Source: Trusted Third Parties are Security Holes
- URL: https://nakamotoinstitute.org/library/trusted-third-parties/
- Verified: Fetched https://nakamotoinstitute.org/library/trusted-third-parties/ on 2026-10-22 (library-html, trusted-third-parties.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 231. Nick Szabo (2001)

> Only any one out of N proxies in a proxy chain need be trustworthy for the privacy to be preserved.

- Source: Trusted Third Parties are Security Holes
- URL: https://nakamotoinstitute.org/library/trusted-third-parties/
- Verified: Fetched https://nakamotoinstitute.org/library/trusted-third-parties/ on 2026-10-22 (library-html, trusted-third-parties.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 232. Nick Szabo (2001)

> The first protocol family in which trust can be distributed to preserve privacy is the Chaum mixes.

- Source: Trusted Third Parties are Security Holes
- URL: https://nakamotoinstitute.org/library/trusted-third-parties/
- Verified: Fetched https://nakamotoinstitute.org/library/trusted-third-parties/ on 2026-10-22 (library-html, trusted-third-parties.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 233. Nick Szabo (2001)

> The functionality of personal property has not under normal conditions ever depended on trusted third parties.

- Source: Trusted Third Parties are Security Holes
- URL: https://nakamotoinstitute.org/library/trusted-third-parties/
- Verified: Fetched https://nakamotoinstitute.org/library/trusted-third-parties/ on 2026-10-22 (library-html, trusted-third-parties.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 234. Nick Szabo (2001)

> The substitution of "vulnerable to" for "trusted" works well in protocol design, and in communicating honestly about the security of a protocol.

- Source: Trusted Third Parties are Security Holes
- URL: https://nakamotoinstitute.org/library/trusted-third-parties/
- Verified: Fetched https://nakamotoinstitute.org/library/trusted-third-parties/ on 2026-10-22 (library-html, trusted-third-parties.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 235. Nick Szabo (2002)

> A novelty of the 20th century was the issue of fiat currencies by governments. ("Fiat" means not backed by any reserve commodity, as the gold- and silver-based currencies of previous centuries were).

- Source: Shelling Out: The Origins of Money
- URL: https://nakamotoinstitute.org/library/shelling-out/
- Verified: Fetched https://nakamotoinstitute.org/library/shelling-out/ on 2026-10-22 (library-html, shelling-out.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 236. Nick Szabo (2002)

> As we shall see, clans, and individuals greatly benefited from a timely transfer of wealth during these events.

- Source: Shelling Out: The Origins of Money
- URL: https://nakamotoinstitute.org/library/shelling-out/
- Verified: Fetched https://nakamotoinstitute.org/library/shelling-out/ on 2026-10-22 (library-html, shelling-out.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 237. Nick Szabo (2002)

> For humans it comes into play in any system of exchange – reciprocation of favors, barter, money, credit, employment, or purchase in a market.

- Source: Shelling Out: The Origins of Money
- URL: https://nakamotoinstitute.org/library/shelling-out/
- Verified: Fetched https://nakamotoinstitute.org/library/shelling-out/ on 2026-10-22 (library-html, shelling-out.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 238. Nick Szabo (2002)

> If clams can be money, furs can be money, gold can be money, and so on – if money is not just coins or notes issued by a government under legal tender laws, but rather can be a wide variety of objects – then just what is money anyway?

- Source: Shelling Out: The Origins of Money
- URL: https://nakamotoinstitute.org/library/shelling-out/
- Verified: Fetched https://nakamotoinstitute.org/library/shelling-out/ on 2026-10-22 (library-html, shelling-out.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 239. Nick Szabo (2002)

> If there had existed a high degree of sustained interaction and trust between tribes, or individuals of different tribes, so that they gave each other unsecured credit, this would have stimulated time-lagged barter trade.

- Source: Shelling Out: The Origins of Money
- URL: https://nakamotoinstitute.org/library/shelling-out/
- Verified: Fetched https://nakamotoinstitute.org/library/shelling-out/ on 2026-10-22 (library-html, shelling-out.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 240. Nick Szabo (2002)

> In order for this market to work – in order for prices to accurately communicate value – first the participants must be able to measure the value of the two commodities traded.

- Source: Measuring Value
- URL: https://nakamotoinstitute.org/library/measuring-value/
- Verified: Fetched https://nakamotoinstitute.org/library/measuring-value/ on 2026-10-22 (library-html, measuring-value.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 241. Nick Szabo (2002)

> Money greatly improved the workings of even small barter networks by greatly reducing the need for credit.

- Source: Shelling Out: The Origins of Money
- URL: https://nakamotoinstitute.org/library/shelling-out/
- Verified: Fetched https://nakamotoinstitute.org/library/shelling-out/ on 2026-10-22 (library-html, shelling-out.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 242. Nick Szabo (2002)

> Non-fiat money and collectibles obtain their value primarily from their scarcity, i.e. their cost of replacement.

- Source: Measuring Value
- URL: https://nakamotoinstitute.org/library/measuring-value/
- Verified: Fetched https://nakamotoinstitute.org/library/measuring-value/ on 2026-10-22 (library-html, measuring-value.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 243. Nick Szabo (2002)

> The greater wealth flowing through markets, now available to be taxed, boosted the king's revenues even beyond the normal Laffer curve effect of reducing mismeasurement between given tax sources.

- Source: Shelling Out: The Origins of Money
- URL: https://nakamotoinstitute.org/library/shelling-out/
- Verified: Fetched https://nakamotoinstitute.org/library/shelling-out/ on 2026-10-22 (library-html, shelling-out.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 244. Nick Szabo (2002)

> The king, deriving his revenue from tax collection, had a strong incentive to measure to value of wealth held and exchanged by his subjects more accurately.

- Source: Shelling Out: The Origins of Money
- URL: https://nakamotoinstitute.org/library/shelling-out/
- Verified: Fetched https://nakamotoinstitute.org/library/shelling-out/ on 2026-10-22 (library-html, shelling-out.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 245. Nick Szabo (2002)

> The predominant relationship between tribes was one of distrust on good days and outright violence on bad days.

- Source: Shelling Out: The Origins of Money
- URL: https://nakamotoinstitute.org/library/shelling-out/
- Verified: Fetched https://nakamotoinstitute.org/library/shelling-out/ on 2026-10-22 (library-html, shelling-out.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 246. Nick Szabo (2002)

> The unforgeable costliness of standard weights of precious metals could now be "assayed" in a marketplace, by wage earners, or by tax collectors via trademark, i.e. trust in the mint's brand, instead of chopping coiled wire at a randomly selected spot.

- Source: Shelling Out: The Origins of Money
- URL: https://nakamotoinstitute.org/library/shelling-out/
- Verified: Fetched https://nakamotoinstitute.org/library/shelling-out/ on 2026-10-22 (library-html, shelling-out.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 247. Nick Szabo (2002)

> They are working backwards from a very clear theory of competitive markets to explain the wide variety of other kinds of economic relationships, usually formalized by property rights and contracts, that we enter into.

- Source: Measuring Value
- URL: https://nakamotoinstitute.org/library/measuring-value/
- Verified: Fetched https://nakamotoinstitute.org/library/measuring-value/ on 2026-10-22 (library-html, measuring-value.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 248. Nick Szabo (2004)

> Automatic currency conversion, as done today by some credit cards and ATM machines, is a useful primitive kind of market translation.

- Source: Scarce Objects
- URL: https://nakamotoinstitute.org/library/scarce-objects/
- Verified: Fetched https://nakamotoinstitute.org/library/scarce-objects/ on 2026-10-22 (library-html, scarce-objects.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 249. Nick Szabo (2004)

> In turn, the market translator, to enable automated (low mental transaction cost) bartering operations, depends on the existence of reasonably liquid online exchanges of generic scarce object rights.

- Source: Scarce Objects
- URL: https://nakamotoinstitute.org/library/scarce-objects/
- Verified: Fetched https://nakamotoinstitute.org/library/scarce-objects/ on 2026-10-22 (library-html, scarce-objects.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 250. Nick Szabo (2004)

> Property rights and contracts are highly evolved methodologies for dealing with economic objects and each other across trust boundaries.

- Source: Scarce Objects
- URL: https://nakamotoinstitute.org/library/scarce-objects/
- Verified: Fetched https://nakamotoinstitute.org/library/scarce-objects/ on 2026-10-22 (library-html, scarce-objects.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 251. Nick Szabo (2004)

> The MT is only a "shopping bot" in the restricted but important area of contracts composed of atomic bearer contracts – rights to scarce objects – to the extent that the price relationships between these bearer contracts are available from quoted markets.

- Source: Scarce Objects
- URL: https://nakamotoinstitute.org/library/scarce-objects/
- Verified: Fetched https://nakamotoinstitute.org/library/scarce-objects/ on 2026-10-22 (library-html, scarce-objects.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 252. Nick Szabo (2005)

> Alice adds the challenge string and the timestamped proof of work string to a distributed property title registry for bit gold.

- Source: Bit Gold
- URL: https://nakamotoinstitute.org/library/bit-gold/
- Verified: Fetched https://nakamotoinstitute.org/library/bit-gold/ on 2026-10-22 (library-html, bit-gold.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 253. Nick Szabo (2005)

> Alice on her computer generates the proof of work string from the challenge bits using a benchmark function.

- Source: Bit Gold
- URL: https://nakamotoinstitute.org/library/bit-gold/
- Verified: Fetched https://nakamotoinstitute.org/library/bit-gold/ on 2026-10-22 (library-html, bit-gold.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 254. Nick Szabo (2005)

> Bit gold may provide us with a money of unprecedented security from these dangers.

- Source: Bit Gold
- URL: https://nakamotoinstitute.org/library/bit-gold/
- Verified: Fetched https://nakamotoinstitute.org/library/bit-gold/ on 2026-10-22 (library-html, bit-gold.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 255. Nick Szabo (2005)

> The potential for initially hidden supply gluts due to hidden innovations in machine architecture is a potential flaw in bit gold, or at least an imperfection which the initial auctions and ex post exchanges of bit gold will have to address.

- Source: Bit Gold
- URL: https://nakamotoinstitute.org/library/bit-gold/
- Verified: Fetched https://nakamotoinstitute.org/library/bit-gold/ on 2026-10-22 (library-html, bit-gold.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 256. Nick Szabo (2005)

> The problem, in a nutshell, is that our money currently depends on trust in a third party for its value.

- Source: Bit Gold
- URL: https://nakamotoinstitute.org/library/bit-gold/
- Verified: Fetched https://nakamotoinstitute.org/library/bit-gold/ on 2026-10-22 (library-html, bit-gold.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 257. Nick Szabo (2005)

> To assay the value of a string of bit gold, Bob checks and verifies the challenge bits, the proof of work string, and the timestamp.

- Source: Bit Gold
- URL: https://nakamotoinstitute.org/library/bit-gold/
- Verified: Fetched https://nakamotoinstitute.org/library/bit-gold/ on 2026-10-22 (library-html, bit-gold.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 258. Nick Szabo (2005)

> Transporting large values of metal can be a rather insecure affair, as the British found when transporting gold across a U-boat infested Atlantic to Canada during World War I to support their gold standard.

- Source: Bit Gold
- URL: https://nakamotoinstitute.org/library/bit-gold/
- Verified: Fetched https://nakamotoinstitute.org/library/bit-gold/ on 2026-10-22 (library-html, bit-gold.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 259. Nick Szabo (2005)

> Unlike fungible atoms of gold, but as with collector's items, a large supply during a given time period will drive down the value of those particular items.

- Source: Bit Gold
- URL: https://nakamotoinstitute.org/library/bit-gold/
- Verified: Fetched https://nakamotoinstitute.org/library/bit-gold/ on 2026-10-22 (library-html, bit-gold.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 260. Nick Szabo (2006)

> As computers become "smarter" dry code is (very slowly) coming to do more that was formerly only done by wet code.

- Source: Wet Code and Dry
- URL: https://nakamotoinstitute.org/library/wet-code-and-dry/
- Verified: Fetched https://nakamotoinstitute.org/library/wet-code-and-dry/ on 2026-10-22 (library-html, wet-code-and-dry.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 261. Nick Szabo (2006)

> Once it successfully emulates wet code it soon surpasses it in many respects; for example by now dry code can do simple arithmetic billions of times faster than the typical human.

- Source: Wet Code and Dry
- URL: https://nakamotoinstitute.org/library/wet-code-and-dry/
- Verified: Fetched https://nakamotoinstitute.org/library/wet-code-and-dry/ on 2026-10-22 (library-html, wet-code-and-dry.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 262. Nick Szabo (2006)

> The syntactic properties of wet and dry code are often very similar -- for example, both human and computer language can usually be parsed by pushdown automata into context-free grammars.

- Source: Wet Code and Dry
- URL: https://nakamotoinstitute.org/library/wet-code-and-dry/
- Verified: Fetched https://nakamotoinstitute.org/library/wet-code-and-dry/ on 2026-10-22 (library-html, wet-code-and-dry.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 263. Nick Szabo (2008)

> As a result, pooling and tranching will work far better for bit gold than it does for actual rare postage stamps.

- Source: Bit Gold Markets
- URL: https://nakamotoinstitute.org/library/bit-gold-markets/
- Verified: Fetched https://nakamotoinstitute.org/library/bit-gold-markets/ on 2026-10-22 (library-html, bit-gold-markets.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 264. Nick Szabo (2008)

> The value of gold today is almost entirely based on its monetary value rather than mere aesthetic value.

- Source: Bit Gold Markets
- URL: https://nakamotoinstitute.org/library/bit-gold-markets/
- Verified: Fetched https://nakamotoinstitute.org/library/bit-gold-markets/ on 2026-10-22 (library-html, bit-gold-markets.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 265. Nick Szabo (2008)

> Then divide each pool into tranches to create your standard currency denominations.

- Source: Bit Gold Markets
- URL: https://nakamotoinstitute.org/library/bit-gold-markets/
- Verified: Fetched https://nakamotoinstitute.org/library/bit-gold-markets/ on 2026-10-22 (library-html, bit-gold-markets.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 266. Nick Szabo (2008)

> There are plenty of metals that are as shiny and smooth as gold, but people don't demand them as a store of value or medium of exchange because they are common.

- Source: Bit Gold Markets
- URL: https://nakamotoinstitute.org/library/bit-gold-markets/
- Verified: Fetched https://nakamotoinstitute.org/library/bit-gold-markets/ on 2026-10-22 (library-html, bit-gold-markets.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 267. Nick Szabo (2008)

> Value comes to attach to the unique aesthetic features of gold or diamonds because these features signal scarcity.

- Source: Bit Gold Markets
- URL: https://nakamotoinstitute.org/library/bit-gold-markets/
- Verified: Fetched https://nakamotoinstitute.org/library/bit-gold-markets/ on 2026-10-22 (library-html, bit-gold-markets.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 268. Nick Szabo (2011)

> Bitcoin is not a list of cryptographic features, it's a very complex system of interacting mathematics and protocols in pursuit of what was a very unpopular goal.

- Source: Bitcoin, what took ye so long?
- URL: https://nakamotoinstitute.org/library/bitcoin-what-took-ye-so-long/
- Verified: Fetched https://nakamotoinstitute.org/library/bitcoin-what-took-ye-so-long/ on 2026-10-22 (library-html, bitcoin-what-took-ye-so-long.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 269. Nick Szabo (2011)

> Even though I had rebutted these arguments in my study of the origins of money, which I humbly suggest should be should be required reading for anybody debating the economics of Bitcoin.

- Source: Bitcoin, what took ye so long?
- URL: https://nakamotoinstitute.org/library/bitcoin-what-took-ye-so-long/
- Verified: Fetched https://nakamotoinstitute.org/library/bitcoin-what-took-ye-so-long/ on 2026-10-22 (library-html, bitcoin-what-took-ye-so-long.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 270. Nick Szabo (2011)

> The "why" requires coming to an accurate understanding of the nature of two difficult and almost always misunderstood topics, namely trust and the nature of money.

- Source: Bitcoin, what took ye so long?
- URL: https://nakamotoinstitute.org/library/bitcoin-what-took-ye-so-long/
- Verified: Fetched https://nakamotoinstitute.org/library/bitcoin-what-took-ye-so-long/ on 2026-10-22 (library-html, bitcoin-what-took-ye-so-long.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 271. Nick Szabo (2011)

> The short answer about why it took so long is that the bit gold/Bitcoin ideas were nowhere remotely close to being as obvious gwern suggests.

- Source: Bitcoin, what took ye so long?
- URL: https://nakamotoinstitute.org/library/bitcoin-what-took-ye-so-long/
- Verified: Fetched https://nakamotoinstitute.org/library/bitcoin-what-took-ye-so-long/ on 2026-10-22 (library-html, bitcoin-what-took-ye-so-long.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 272. Nick Szabo (2017)

> An individual or group communicating under the name "Satoshi Nakamoto" brought Bitcoin to the Internet in 2009.

- Source: Money, Blockchains, and Social Scalability
- URL: https://nakamotoinstitute.org/library/money-blockchains-and-social-scalability/
- Verified: Fetched https://nakamotoinstitute.org/library/money-blockchains-and-social-scalability/ on 2026-10-22 (library-html, money-blockchains-and-social-scalability.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 273. Nick Szabo (2017)

> Bitcoin's socially scalable security, based on computer science rather than on police and lawyers, allows, for example, customers in Africa to pay suppliers in China seamlessly across borders.

- Source: Money, Blockchains, and Social Scalability
- URL: https://nakamotoinstitute.org/library/money-blockchains-and-social-scalability/
- Verified: Fetched https://nakamotoinstitute.org/library/money-blockchains-and-social-scalability/ on 2026-10-22 (library-html, money-blockchains-and-social-scalability.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 274. Nick Szabo (2017)

> Gold can have value anywhere in the world and is immune from hyperinflation because its value doesn't depend on a central authority.

- Source: Money, Blockchains, and Social Scalability
- URL: https://nakamotoinstitute.org/library/money-blockchains-and-social-scalability/
- Verified: Fetched https://nakamotoinstitute.org/library/money-blockchains-and-social-scalability/ on 2026-10-22 (library-html, money-blockchains-and-social-scalability.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 275. Nick Szabo (2017)

> In most cases an often trusted and sufficiently trustworthy institution (such as a market) depends on its participants trusting, usually implicitly, another sufficiently trustworthy institution (such as contract law).

- Source: Money, Blockchains, and Social Scalability
- URL: https://nakamotoinstitute.org/library/money-blockchains-and-social-scalability/
- Verified: Fetched https://nakamotoinstitute.org/library/money-blockchains-and-social-scalability/ on 2026-10-22 (library-html, money-blockchains-and-social-scalability.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 276. Nick Szabo (2017)

> Lower value transactions with lower fees will need to be implemented on peripheral bitcoin networks.

- Source: Money, Blockchains, and Social Scalability
- URL: https://nakamotoinstitute.org/library/money-blockchains-and-social-scalability/
- Verified: Fetched https://nakamotoinstitute.org/library/money-blockchains-and-social-scalability/ on 2026-10-22 (library-html, money-blockchains-and-social-scalability.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 277. Nick Szabo (2017)

> Money and markets also incentivize creation of more accurate price signals that reduce negotiation costs and errors for participants in other similar exchanges.

- Source: Money, Blockchains, and Social Scalability
- URL: https://nakamotoinstitute.org/library/money-blockchains-and-social-scalability/
- Verified: Fetched https://nakamotoinstitute.org/library/money-blockchains-and-social-scalability/ on 2026-10-22 (library-html, money-blockchains-and-social-scalability.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 278. Nick Szabo (2017)

> Money and markets directly benefit the participants in each particular trade by the market matching a buyer with a mutually beneficial seller and by a widely acceptable and standardized counter-performance (money).

- Source: Money, Blockchains, and Social Scalability
- URL: https://nakamotoinstitute.org/library/money-blockchains-and-social-scalability/
- Verified: Fetched https://nakamotoinstitute.org/library/money-blockchains-and-social-scalability/ on 2026-10-22 (library-html, money-blockchains-and-social-scalability.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 279. Nick Szabo (2017)

> Scalable money requires scalable security, so that a greater number and variety of people can use the currency without losing its integrity against forgery, inflation, and theft.

- Source: Money, Blockchains, and Social Scalability
- URL: https://nakamotoinstitute.org/library/money-blockchains-and-social-scalability/
- Verified: Fetched https://nakamotoinstitute.org/library/money-blockchains-and-social-scalability/ on 2026-10-22 (library-html, money-blockchains-and-social-scalability.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 280. Parker Lewis (2023)

> A common refrain among skeptics, especially central bankers, is that bitcoin is too volatile to be a store of value, medium of exchange, or unit of account.

- Source: Gradually, Then Suddenly: Bitcoin Is Not Too Volatile
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-volatile/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-volatile/ on 2026-10-22 (gts, bitcoin-is-not-too-volatile.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 281. Parker Lewis (2023)

> A network of banks could be set up on top of the bitcoin network, and the payments system could function as it does today.

- Source: Gradually, Then Suddenly: Bitcoin Is Not Too Slow
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-slow/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-slow/ on 2026-10-22 (gts, bitcoin-is-not-too-slow.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 282. Parker Lewis (2023)

> Among its perceived flaws as a currency, critics view bitcoin as being too complicated to ever achieve widespread adoption.

- Source: Gradually, Then Suddenly: Bitcoin Is Common Sense
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-common-sense/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-common-sense/ on 2026-10-22 (gts, bitcoin-is-common-sense.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 283. Parker Lewis (2023)

> Anyone that produces value and exchanges it for bitcoin is assured that their output will not be devalued in the future merely as a function of someone creating new units of money.

- Source: Gradually, Then Suddenly: Bitcoin Is One for All
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-one-for-all/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-one-for-all/ on 2026-10-22 (gts, bitcoin-is-one-for-all.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 284. Parker Lewis (2023)

> As a fundamentally better form of money, bitcoin will gain purchasing power relative to inferior monetary assets (and money substitutes), despite being less functional as a transactional currency today in direct trade.

- Source: Gradually, Then Suddenly: Bitcoin Is Not Too Volatile
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-volatile/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-volatile/ on 2026-10-22 (gts, bitcoin-is-not-too-volatile.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 285. Parker Lewis (2023)

> As a result, the credit system became the marginal price-setting mechanism rather than the base money.

- Source: Gradually, Then Suddenly: Bitcoin Fixes This
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-fixes-this/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-fixes-this/ on 2026-10-22 (gts, bitcoin-fixes-this.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 286. Parker Lewis (2023)

> As adoption increases, each individual (on average) controls an ever-diminishing share of the network's fixed supply, and it is the scarcity of the currency which primarily drives adoption.

- Source: Gradually, Then Suddenly: Bitcoin Is Not for Criminals
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-for-criminals/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-for-criminals/ on 2026-10-22 (gts, bitcoin-is-not-for-criminals.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 287. Parker Lewis (2023)

> As each individual within the network holds a smaller and smaller share of the currency (on average) over time, it results in a dynamic where price is decreasingly dependent on the preferences of a few large holders.

- Source: Gradually, Then Suddenly: Bitcoin Is Antifragile
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-antifragile/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-antifragile/ on 2026-10-22 (gts, bitcoin-is-antifragile.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 288. Parker Lewis (2023)

> As individuals get closer to the precipice of understanding bitcoin as money, there is commonly an instinctive and reactionary thought that the government will never allow it.

- Source: Gradually, Then Suddenly: Bitcoin Cannot Be Banned
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-banned/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-banned/ on 2026-10-22 (gts, bitcoin-cannot-be-banned.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 289. Parker Lewis (2023)

> As individuals opt in to bitcoin, they are simultaneously opting out of inferior monetary networks.

- Source: Gradually, Then Suddenly: Bitcoin, Not Blockchain
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-not-blockchain/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-not-blockchain/ on 2026-10-22 (gts, bitcoin-not-blockchain.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 290. Parker Lewis (2023)

> As more and more individuals collectively identify that bitcoin is the monetary good with the greatest relative scarcity, stability in its price will become an emergent property.

- Source: Gradually, Then Suddenly: Bitcoin Obsoletes All Other Money
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-obsoletes-all-other-money/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-obsoletes-all-other-money/ on 2026-10-22 (gts, bitcoin-obsoletes-all-other-money.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 291. Parker Lewis (2023)

> As more individuals value bitcoin, the network not only becomes a greater utility, but it also becomes more secure.

- Source: Gradually, Then Suddenly: Bitcoin Obsoletes All Other Money
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-obsoletes-all-other-money/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-obsoletes-all-other-money/ on 2026-10-22 (gts, bitcoin-obsoletes-all-other-money.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 292. Parker Lewis (2023)

> As more people adopt bitcoin and as the network becomes more decentralized, the outcome becomes more probable.

- Source: Gradually, Then Suddenly: Conclusion
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/conclusion/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/conclusion/ on 2026-10-22 (gts, conclusion.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 293. Parker Lewis (2023)

> As more people adopt bitcoin, the currency is transferred from the haves to have-nots.

- Source: Gradually, Then Suddenly: Bitcoin Is One for All
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-one-for-all/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-one-for-all/ on 2026-10-22 (gts, bitcoin-is-one-for-all.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 294. Parker Lewis (2023)

> As part of this process, the financial system will shrink in size relative to the purchasing power of the bitcoin network.

- Source: Gradually, Then Suddenly: Bitcoin Is the Great Definancialization
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-the-great-definancialization/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-the-great-definancialization/ on 2026-10-22 (gts, bitcoin-is-the-great-definancialization.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 295. Parker Lewis (2023)

> As the value of bitcoin rises, it is an indication that market participants increasingly prefer holding bitcoin over dollars.

- Source: Gradually, Then Suddenly: Bitcoin Is Not Backed by Nothing
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-backed-by-nothing/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-backed-by-nothing/ on 2026-10-22 (gts, bitcoin-is-not-backed-by-nothing.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 296. Parker Lewis (2023)

> As they do in India, people continue to use bitcoin in China with no disruption to the network.

- Source: Gradually, Then Suddenly: Bitcoin Is Antifragile
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-antifragile/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-antifragile/ on 2026-10-22 (gts, bitcoin-is-antifragile.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 297. Parker Lewis (2023)

> As with every technology, value will accrue to those who utilize bitcoin in its highest and best use, a function that only the market can determine.

- Source: Gradually, Then Suddenly: Bitcoin Is Not for Criminals
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-for-criminals/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-for-criminals/ on 2026-10-22 (gts, bitcoin-is-not-for-criminals.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 298. Parker Lewis (2023)

> At its most fundamental core, bitcoin is money, and it is the greatest instrument of freedom ever invented by man.

- Source: Gradually, Then Suddenly: Conclusion
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/conclusion/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/conclusion/ on 2026-10-22 (gts, conclusion.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 299. Parker Lewis (2023)

> At the end of the day, bitcoin is a currency whose supply (and derivatively its price system) cannot be manipulated.

- Source: Gradually, Then Suddenly: Bitcoin Is Common Sense
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-common-sense/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-common-sense/ on 2026-10-22 (gts, bitcoin-is-common-sense.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 300. Parker Lewis (2023)

> At the end of the day, the value of bitcoin is not dependent on any single individual figuring it out and buying in.

- Source: Gradually, Then Suddenly: Bitcoin Is Not a Pyramid Scheme
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-a-pyramid-scheme/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-a-pyramid-scheme/ on 2026-10-22 (gts, bitcoin-is-not-a-pyramid-scheme.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 301. Parker Lewis (2023)

> At the same time, bitcoin has been around for twelve years---as of the time of writing---and has a total purchasing power (or value) of $180 billion.

- Source: Gradually, Then Suddenly: Bitcoin Is Antifragile
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-antifragile/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-antifragile/ on 2026-10-22 (gts, bitcoin-is-antifragile.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 302. Parker Lewis (2023)

> At the same time, bitcoin was created as a solution to the problem of printing money.

- Source: Gradually, Then Suddenly: Conclusion
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/conclusion/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/conclusion/ on 2026-10-22 (gts, conclusion.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 303. Parker Lewis (2023)

> Before bitcoin, the privilege of creating new money out of thin air was reserved to global central banks, including the Federal Reserve.

- Source: Gradually, Then Suddenly: Bitcoin Cannot Be Copied
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-copied/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-copied/ on 2026-10-22 (gts, bitcoin-cannot-be-copied.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 304. Parker Lewis (2023)

> Bitcoin becomes increasingly decentralized and increasingly censorship-resistant as its value increases and as it scales at all levels of the network.

- Source: Gradually, Then Suddenly: Bitcoin Cannot Be Copied
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-copied/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-copied/ on 2026-10-22 (gts, bitcoin-cannot-be-copied.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 305. Parker Lewis (2023)

> Bitcoin becomes more resistant to censorship as it scales because the network becomes more decentralized over time.

- Source: Gradually, Then Suddenly: Bitcoin Is Not for Criminals
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-for-criminals/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-for-criminals/ on 2026-10-22 (gts, bitcoin-is-not-for-criminals.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 306. Parker Lewis (2023)

> Bitcoin consumes only the energy that the free market will bear at a free-market rate.

- Source: Gradually, Then Suddenly: Bitcoin Does Not Waste Energy
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-does-not-waste-energy/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-does-not-waste-energy/ on 2026-10-22 (gts, bitcoin-does-not-waste-energy.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 307. Parker Lewis (2023)

> Bitcoin has become money over time only as the bitcoin network has developed emergent properties that did not exist at inception and that are next to impossible to replicate now that bitcoin exists.

- Source: Gradually, Then Suddenly: Bitcoin Cannot Be Copied
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-copied/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-copied/ on 2026-10-22 (gts, bitcoin-cannot-be-copied.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 308. Parker Lewis (2023)

> Bitcoin is a long-term savings mechanism, and stability in the value of bitcoin will emerge over time as a function of mass adoption.

- Source: Gradually, Then Suddenly: Bitcoin Is Not Too Volatile
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-volatile/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-volatile/ on 2026-10-22 (gts, bitcoin-is-not-too-volatile.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 309. Parker Lewis (2023)

> Bitcoin is only valuable as a form of money and holds value because it has credible monetary properties.

- Source: Gradually, Then Suddenly: Bitcoin, Not Blockchain
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-not-blockchain/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-not-blockchain/ on 2026-10-22 (gts, bitcoin-not-blockchain.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 310. Parker Lewis (2023)

> Bitcoin is the superior successor to gold and the fiat money systems that leveraged gold's monetary properties.

- Source: Gradually, Then Suddenly: Bitcoin Is Not Backed by Nothing
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-backed-by-nothing/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-backed-by-nothing/ on 2026-10-22 (gts, bitcoin-is-not-backed-by-nothing.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 311. Parker Lewis (2023)

> Bitcoin is valuable not because of a particular feature but because it has achieved finite, digital scarcity, through which it derives its store-of-value property.

- Source: Gradually, Then Suddenly: Bitcoin Cannot Be Copied
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-copied/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-copied/ on 2026-10-22 (gts, bitcoin-cannot-be-copied.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 312. Parker Lewis (2023)

> Bitcoin may not be synonymous with the right to life, liberty, and the pursuit of happiness, but it is a fundamental and inalienable right for those who choose to rely upon it as a better path forward.

- Source: Gradually, Then Suddenly: Bitcoin Is a Rally Cry
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-a-rally-cry/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-a-rally-cry/ on 2026-10-22 (gts, bitcoin-is-a-rally-cry.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 313. Parker Lewis (2023)

> Bitcoin might technically exist because some highly intelligent individuals identified a problem and set the wheels in motion to create a solution, but it functionally exists because it fixes the problem of printing money.

- Source: Gradually, Then Suddenly: Bitcoin Fixes This
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-fixes-this/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-fixes-this/ on 2026-10-22 (gts, bitcoin-fixes-this.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 314. Parker Lewis (2023)

> Bitcoin represents a solution to the systemic issues within our legacy monetary framework, and it relies on energy consumption to function.

- Source: Gradually, Then Suddenly: Bitcoin Does Not Waste Energy
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-does-not-waste-energy/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-does-not-waste-energy/ on 2026-10-22 (gts, bitcoin-does-not-waste-energy.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 315. Parker Lewis (2023)

> Bitcoin represents the conversion of subjective value, created and exchanged in the real world, for information controlled by digital keys.

- Source: Gradually, Then Suddenly: Bitcoin Cannot Be Banned
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-banned/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-banned/ on 2026-10-22 (gts, bitcoin-cannot-be-banned.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 316. Parker Lewis (2023)

> Bitcoin ultimately represents the contrast between monetary policy by consensus and monetary policy by central bank.

- Source: Gradually, Then Suddenly: Bitcoin Is Not a Pyramid Scheme
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-a-pyramid-scheme/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-a-pyramid-scheme/ on 2026-10-22 (gts, bitcoin-is-not-a-pyramid-scheme.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 317. Parker Lewis (2023)

> Bitcoin will consume any and all energy resources necessary to secure its monetary network, which is inherently driven by the base demand to hold it as a currency.

- Source: Gradually, Then Suddenly: Bitcoin Does Not Waste Energy
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-does-not-waste-energy/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-does-not-waste-energy/ on 2026-10-22 (gts, bitcoin-does-not-waste-energy.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 318. Parker Lewis (2023)

> Bitcoin will continue to steal market share in the global store of value competition because of its superior monetary properties.

- Source: Gradually, Then Suddenly: Bitcoin Is Not Too Volatile
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-volatile/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-volatile/ on 2026-10-22 (gts, bitcoin-is-not-too-volatile.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 319. Parker Lewis (2023)

> Bitcoin will transition to a transactional currency only as more people first understand why it will store value.

- Source: Gradually, Then Suddenly: Bitcoin Is Not Too Volatile
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-volatile/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-volatile/ on 2026-10-22 (gts, bitcoin-is-not-too-volatile.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 320. Parker Lewis (2023)

> Bitcoin, as with any money, is functional for one purpose, to store value between a series of exchanges.

- Source: Gradually, Then Suddenly: Bitcoin Obsoletes All Other Money
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-obsoletes-all-other-money/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-obsoletes-all-other-money/ on 2026-10-22 (gts, bitcoin-obsoletes-all-other-money.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 321. Parker Lewis (2023)

> Bitcoin, on the other hand, entrusts its monetary policy to a consensus mechanism of those that hold bitcoin as a currency.

- Source: Gradually, Then Suddenly: Bitcoin Is Not a Pyramid Scheme
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-a-pyramid-scheme/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-a-pyramid-scheme/ on 2026-10-22 (gts, bitcoin-is-not-a-pyramid-scheme.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 322. Parker Lewis (2023)

> Bitcoin's innovation is that it represents a superior form of money, which is finitely scarce.

- Source: Gradually, Then Suddenly: Bitcoin Is Not a Pyramid Scheme
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-a-pyramid-scheme/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-a-pyramid-scheme/ on 2026-10-22 (gts, bitcoin-is-not-a-pyramid-scheme.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 323. Parker Lewis (2023)

> Central banks create more and more money, which causes savings to be perpetually devalued.

- Source: Gradually, Then Suddenly: Bitcoin Is the Great Definancialization
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-the-great-definancialization/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-the-great-definancialization/ on 2026-10-22 (gts, bitcoin-is-the-great-definancialization.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 324. Parker Lewis (2023)

> Every fiat currency, commodity money (e.g., gold), and cryptocurrency is competing for the exact same use case as bitcoin, whether it is consciously understood by market participants or not.

- Source: Gradually, Then Suddenly: Bitcoin, Not Blockchain
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-not-blockchain/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-not-blockchain/ on 2026-10-22 (gts, bitcoin-not-blockchain.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 325. Parker Lewis (2023)

> Every other cryptocurrency is competing for the identical use case as bitcoin, that of money.

- Source: Gradually, Then Suddenly: Bitcoin, Not Blockchain
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-not-blockchain/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-not-blockchain/ on 2026-10-22 (gts, bitcoin-not-blockchain.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 326. Parker Lewis (2023)

> Every other fiat currency, commodity money, or cryptocurrency is competing for the exact same use case as bitcoin, whether it is understood or not.

- Source: Gradually, Then Suddenly: Bitcoin Cannot Be Copied
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-copied/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-copied/ on 2026-10-22 (gts, bitcoin-cannot-be-copied.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 327. Parker Lewis (2023)

> Every time the Fed, or any central bank, announces subsequent rounds of QE, it reinforces to the market why bitcoin exists.

- Source: Gradually, Then Suddenly: Bitcoin Fixes This
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-fixes-this/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-fixes-this/ on 2026-10-22 (gts, bitcoin-fixes-this.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 328. Parker Lewis (2023)

> Everyone will be able to rely on bitcoin's fixed supply and trust that changes throughout bitcoin's price system will always be true, free from unpredictable changes in the money supply.

- Source: Gradually, Then Suddenly: Bitcoin Is One for All
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-one-for-all/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-one-for-all/ on 2026-10-22 (gts, bitcoin-is-one-for-all.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 329. Parker Lewis (2023)

> Everything comes with trade-offs, but there are two holy grails in bitcoin: enforcing a fixed supply and preventing individual units of the currency from being spent multiple times (the double-spending problem).

- Source: Gradually, Then Suddenly: Bitcoin Is Not Too Slow
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-slow/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-slow/ on 2026-10-22 (gts, bitcoin-is-not-too-slow.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 330. Parker Lewis (2023)

> Everything of value comes with a cost, and there is no more important use for energy than securing the bitcoin network because it provides a sound form of money for the entire world to use, which will ultimately ensure all other demand for energy can be fulfilled via trade.

- Source: Gradually, Then Suddenly: Introduction
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/introduction/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/introduction/ on 2026-10-22 (gts, introduction.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 331. Parker Lewis (2023)

> Future economic stability is why there can be no fundamentally more important source of energy demand than the security of bitcoin's monetary system, especially as central banks print more and more money.

- Source: Gradually, Then Suddenly: Bitcoin Does Not Waste Energy
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-does-not-waste-energy/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-does-not-waste-energy/ on 2026-10-22 (gts, bitcoin-does-not-waste-energy.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 332. Parker Lewis (2023)

> Gold alone has a purchasing power of $8 trillion (50 times the size of bitcoin).

- Source: Gradually, Then Suddenly: Bitcoin Obsoletes All Other Money
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-obsoletes-all-other-money/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-obsoletes-all-other-money/ on 2026-10-22 (gts, bitcoin-obsoletes-all-other-money.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 333. Parker Lewis (2023)

> Gold, on the other hand, has a purchasing power of approximately $8 trillion (40x the size of bitcoin), and the broad money supply of dollars (M2) is approximately $15 trillion (75x the size of bitcoin).

- Source: Gradually, Then Suddenly: Bitcoin Cannot Be Banned
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-banned/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-banned/ on 2026-10-22 (gts, bitcoin-cannot-be-banned.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 334. Parker Lewis (2023)

> Governments will need bitcoin to fund their operations, but to do so, any government would have to tax its citizens to get bitcoin rather than rely on a central bank to print money.

- Source: Gradually, Then Suddenly: Conclusion
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/conclusion/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/conclusion/ on 2026-10-22 (gts, conclusion.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 335. Parker Lewis (2023)

> If anyone could prevent anyone else from utilizing the network (whether it be an individual, an organization, or a nation-state), bitcoin would be at risk of failure.

- Source: Gradually, Then Suddenly: Bitcoin Is Not for Criminals
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-for-criminals/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-for-criminals/ on 2026-10-22 (gts, bitcoin-is-not-for-criminals.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 336. Parker Lewis (2023)

> If bitcoin could work for a criminal, it could work for anyone, and for bitcoin to be viable as a currency, it has to work for everyone, including criminals.

- Source: Gradually, Then Suddenly: Bitcoin Is Not for Criminals
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-for-criminals/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-for-criminals/ on 2026-10-22 (gts, bitcoin-is-not-for-criminals.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 337. Parker Lewis (2023)

> If bitcoin were not functional and could not be expected to hold a certain threshold of value over a particular time horizon, it would not have been used as a medium of exchange.

- Source: Gradually, Then Suddenly: Bitcoin Is Not for Criminals
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-for-criminals/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-for-criminals/ on 2026-10-22 (gts, bitcoin-is-not-for-criminals.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 338. Parker Lewis (2023)

> If bitcoin were not valued as money, there would be no miners, and without miners, there would be no chain worth protecting.

- Source: Gradually, Then Suddenly: Bitcoin, Not Blockchain
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-not-blockchain/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-not-blockchain/ on 2026-10-22 (gts, bitcoin-not-blockchain.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 339. Parker Lewis (2023)

> If it were not for the scarcity of capacity in each bitcoin block, there would not be a mechanism to create a transaction-fee market.

- Source: Gradually, Then Suddenly: Bitcoin Is Not Too Slow
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-slow/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-slow/ on 2026-10-22 (gts, bitcoin-is-not-too-slow.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 340. Parker Lewis (2023)

> If money converges to one and bitcoin is finitely scarce, practically everyone in the world will adopt it as money.

- Source: Gradually, Then Suddenly: Introduction
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/introduction/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/introduction/ on 2026-10-22 (gts, introduction.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 341. Parker Lewis (2023)

> If quantitative easing can be simplified down to a debasement of monetary savings, bitcoin can be simplified down to the freedom to convert value into a form of currency that cannot be printed.

- Source: Gradually, Then Suddenly: Bitcoin Is a Rally Cry
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-a-rally-cry/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-a-rally-cry/ on 2026-10-22 (gts, bitcoin-is-a-rally-cry.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 342. Parker Lewis (2023)

> If the conclusion becomes that bitcoin is not functional as money, the implications of government intervention are irrelevant.

- Source: Gradually, Then Suddenly: Bitcoin Cannot Be Banned
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-banned/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-banned/ on 2026-10-22 (gts, bitcoin-cannot-be-banned.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 343. Parker Lewis (2023)

> If the supply of bitcoin remains fixed at 21 million, more people will demand it, and its purchasing power will increase.

- Source: Gradually, Then Suddenly: Bitcoin Is Common Sense
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-common-sense/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-common-sense/ on 2026-10-22 (gts, bitcoin-is-common-sense.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 344. Parker Lewis (2023)

> If there were more people wanting to sell their bitcoin than people needing to adopt bitcoin as money, then its price and value would decline over time.

- Source: Gradually, Then Suddenly: Bitcoin Is Not a Pyramid Scheme
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-a-pyramid-scheme/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-a-pyramid-scheme/ on 2026-10-22 (gts, bitcoin-is-not-a-pyramid-scheme.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 345. Parker Lewis (2023)

> Imagine you concluded that bitcoin is a superior form of money and that there is a fundamental and acute problem with central banks creating money arbitrarily out of thin air.

- Source: Gradually, Then Suddenly: Bitcoin Is Not a Pyramid Scheme
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-a-pyramid-scheme/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-a-pyramid-scheme/ on 2026-10-22 (gts, bitcoin-is-not-a-pyramid-scheme.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 346. Parker Lewis (2023)

> In "Bitcoin Does Not Waste Energy," I lay out a framework to think about the energy resources that bitcoin demands and why this is not only sustainable but also critical to society beyond bitcoin as an application.

- Source: Gradually, Then Suddenly: Introduction
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/introduction/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/introduction/ on 2026-10-22 (gts, introduction.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 347. Parker Lewis (2023)

> In a free market, money might increase or decrease in value over a particular time horizon.

- Source: Gradually, Then Suddenly: Bitcoin Is the Great Definancialization
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-the-great-definancialization/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-the-great-definancialization/ on 2026-10-22 (gts, bitcoin-is-the-great-definancialization.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 348. Parker Lewis (2023)

> In aggregate, this drives incremental adoption and liquidity, which reinforces and strengthens the value of the bitcoin network.

- Source: Gradually, Then Suddenly: Bitcoin Cannot Be Copied
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-copied/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-copied/ on 2026-10-22 (gts, bitcoin-cannot-be-copied.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 349. Parker Lewis (2023)

> In bitcoin's free market, the highest-value and most profitable transactions are prioritized.

- Source: Gradually, Then Suddenly: Bitcoin Is Not Too Slow
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-slow/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-slow/ on 2026-10-22 (gts, bitcoin-is-not-too-slow.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 350. Parker Lewis (2023)

> In contrast, bitcoin are issued through a mining process that helps secure the network, and the network adjusts to ensure that bitcoin are issued on consistent time intervals.

- Source: Gradually, Then Suddenly: Bitcoin Is Not a Pyramid Scheme
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-a-pyramid-scheme/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-a-pyramid-scheme/ on 2026-10-22 (gts, bitcoin-is-not-a-pyramid-scheme.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 351. Parker Lewis (2023)

> In doing so, bitcoin will preserve and help rebuild the vestiges of freedom that remain.

- Source: Gradually, Then Suddenly: Conclusion
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/conclusion/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/conclusion/ on 2026-10-22 (gts, conclusion.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 352. Parker Lewis (2023)

> In fact, bitcoin payments en masse will invariably have to wait until the market demands that solutions be created, which itself is logically dependent on more people using bitcoin as a savings mechanism.

- Source: Gradually, Then Suddenly: Bitcoin Is Not Too Slow
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-slow/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-slow/ on 2026-10-22 (gts, bitcoin-is-not-too-slow.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 353. Parker Lewis (2023)

> In most cases, an individual or business would reasonably need to first understand why bitcoin will store value into the future as a savings mechanism before accepting bitcoin as a form of payment in direct commerce or trade.

- Source: Gradually, Then Suddenly: Bitcoin Is Not Too Slow
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-slow/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-slow/ on 2026-10-22 (gts, bitcoin-is-not-too-slow.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 354. Parker Lewis (2023)

> In order to acquire any, bitcoin must be earned by delivering value to those that hold the currency.

- Source: Gradually, Then Suddenly: Bitcoin Is One for All
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-one-for-all/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-one-for-all/ on 2026-10-22 (gts, bitcoin-is-one-for-all.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 355. Parker Lewis (2023)

> In the global competition for money, bitcoin has inherent monetary properties that the fiat monetary system lacks.

- Source: Gradually, Then Suddenly: Bitcoin Is Not Backed by Nothing
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-backed-by-nothing/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-backed-by-nothing/ on 2026-10-22 (gts, bitcoin-is-not-backed-by-nothing.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 356. Parker Lewis (2023)

> In their current forms, gold as well as all fiat monetary systems depend on trust, whereas bitcoin is trustless.

- Source: Gradually, Then Suddenly: Bitcoin Obsoletes All Other Money
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-obsoletes-all-other-money/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-obsoletes-all-other-money/ on 2026-10-22 (gts, bitcoin-obsoletes-all-other-money.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 357. Parker Lewis (2023)

> Is scarcity a sufficiently powerful property to allow bitcoin to emerge as money, regardless of whether the form of that scarcity is digital?

- Source: Gradually, Then Suddenly: Bitcoin Is Not Backed by Nothing
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-backed-by-nothing/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-backed-by-nothing/ on 2026-10-22 (gts, bitcoin-is-not-backed-by-nothing.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 358. Parker Lewis (2023)

> It is nothing more than the individual freedom to convert real-world value into a form of money that cannot be manipulated.

- Source: Gradually, Then Suddenly: Bitcoin Is a Rally Cry
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-a-rally-cry/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-a-rally-cry/ on 2026-10-22 (gts, bitcoin-is-a-rally-cry.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 359. Parker Lewis (2023)

> Logically, that individual or business would first need to have determined that bitcoin would hold its value over a particular time horizon.

- Source: Gradually, Then Suddenly: Bitcoin Is Not Too Volatile
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-volatile/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-volatile/ on 2026-10-22 (gts, bitcoin-is-not-too-volatile.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 360. Parker Lewis (2023)

> Many people experience this critical mental block when thinking about bitcoin as a currency, and it is largely a function of time horizon.

- Source: Gradually, Then Suddenly: Bitcoin Is Not Too Volatile
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-volatile/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-volatile/ on 2026-10-22 (gts, bitcoin-is-not-too-volatile.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 361. Parker Lewis (2023)

> Market participants are presented with the choice between holding a form of money that is continually and systematically debased by central banks or a form of money with a fixed supply that cannot be printed.

- Source: Gradually, Then Suddenly: Bitcoin Fixes This
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-fixes-this/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-fixes-this/ on 2026-10-22 (gts, bitcoin-fixes-this.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 362. Parker Lewis (2023)

> No one has to trust or question whether bitcoin's price signals are true because its fixed supply guarantees it.

- Source: Gradually, Then Suddenly: Bitcoin Is One for All
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-one-for-all/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-one-for-all/ on 2026-10-22 (gts, bitcoin-is-one-for-all.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 363. Parker Lewis (2023)

> No other currency in the world can ever be more scarce than bitcoin, and scarcity will act as a gravitational force, driving adoption and the communication of value.

- Source: Gradually, Then Suddenly: Bitcoin Obsoletes All Other Money
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-obsoletes-all-other-money/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-obsoletes-all-other-money/ on 2026-10-22 (gts, bitcoin-obsoletes-all-other-money.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 364. Parker Lewis (2023)

> People produce those things, and money coordinates the preferences of all individuals within an economy, compensating value to varying degrees for time spent.

- Source: Gradually, Then Suddenly: Bitcoin Is Common Sense
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-common-sense/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-common-sense/ on 2026-10-22 (gts, bitcoin-is-common-sense.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 365. Parker Lewis (2023)

> People who do not understand why bitcoin has fundamental value are functionally incapable of doing a cost-benefit analysis.

- Source: Gradually, Then Suddenly: Bitcoin Does Not Waste Energy
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-does-not-waste-energy/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-does-not-waste-energy/ on 2026-10-22 (gts, bitcoin-does-not-waste-energy.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 366. Parker Lewis (2023)

> The avenue may be different for each individual, but at the end of the day, bitcoin is a means to preserve some form of freedom that is otherwise being impaired or infringed.

- Source: Gradually, Then Suddenly: Bitcoin Is a Rally Cry
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-a-rally-cry/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-a-rally-cry/ on 2026-10-22 (gts, bitcoin-is-a-rally-cry.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 367. Parker Lewis (2023)

> The better question is "why does volatility not prevent adoption of bitcoin as money?" Bitcoin has proven to be an exceptional store of value over time, which is fundamental to the function of money.

- Source: Gradually, Then Suddenly: Introduction
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/introduction/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/introduction/ on 2026-10-22 (gts, introduction.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 368. Parker Lewis (2023)

> The bitcoin network represents a total purchasing power of less than $200 billion at present.

- Source: Gradually, Then Suddenly: Bitcoin Cannot Be Banned
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-banned/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-banned/ on 2026-10-22 (gts, bitcoin-cannot-be-banned.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 369. Parker Lewis (2023)

> The concept of time preference is described at length in The Bitcoin Standard by Saifedean Ammous (2018).

- Source: Gradually, Then Suddenly: Bitcoin Is the Great Definancialization
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-the-great-definancialization/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-the-great-definancialization/ on 2026-10-22 (gts, bitcoin-is-the-great-definancialization.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 370. Parker Lewis (2023)

> The dollar's supply is governed by a central bank, whereas bitcoin's supply is governed by a consensus of market participants.

- Source: Gradually, Then Suddenly: Bitcoin Is Not Backed by Nothing
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-backed-by-nothing/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-backed-by-nothing/ on 2026-10-22 (gts, bitcoin-is-not-backed-by-nothing.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 371. Parker Lewis (2023)

> The empirical evidence (price and purchasing power) demonstrates that the market continues to determine that bitcoin is different, despite a significant amount of noise.

- Source: Gradually, Then Suddenly: Bitcoin Cannot Be Copied
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-copied/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-copied/ on 2026-10-22 (gts, bitcoin-cannot-be-copied.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 372. Parker Lewis (2023)

> The fact that bitcoin is volatile should prevent it from being money for the very reason that it is volatile, right?

- Source: Gradually, Then Suddenly: Introduction
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/introduction/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/introduction/ on 2026-10-22 (gts, introduction.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 373. Parker Lewis (2023)

> The foundation of bitcoin's value proposition as money does not happen by magic either.

- Source: Gradually, Then Suddenly: Introduction
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/introduction/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/introduction/ on 2026-10-22 (gts, introduction.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 374. Parker Lewis (2023)

> The government will have to directly seek the transfer of bitcoin from citizens via taxes, which are perennially unpopular, and banks will not be able to be bailed out by politicians with money that does not exist.

- Source: Gradually, Then Suddenly: Conclusion
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/conclusion/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/conclusion/ on 2026-10-22 (gts, conclusion.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 375. Parker Lewis (2023)

> The greater the inclination to store wealth in bitcoin, the lesser the demand to store wealth in the dollar or assets that support the existing dollar credit system.

- Source: Gradually, Then Suddenly: Bitcoin Fixes This
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-fixes-this/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-fixes-this/ on 2026-10-22 (gts, bitcoin-fixes-this.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 376. Parker Lewis (2023)

> The integrity of bitcoin's scarcity and the immutability of its blockchain are ultimately dependent on the value of the currency itself.

- Source: Gradually, Then Suddenly: Bitcoin, Not Blockchain
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-not-blockchain/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-not-blockchain/ on 2026-10-22 (gts, bitcoin-not-blockchain.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 377. Parker Lewis (2023)

> The market is converging on bitcoin over time, and its value continues to increase because it provides a constant---a fixed supply not susceptible to change---that is superior to all other forms of money.

- Source: Gradually, Then Suddenly: Bitcoin Obsoletes All Other Money
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-obsoletes-all-other-money/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-obsoletes-all-other-money/ on 2026-10-22 (gts, bitcoin-obsoletes-all-other-money.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 378. Parker Lewis (2023)

> The market test teaches people that bitcoin cannot be copied better than any amount of reason and logic can.

- Source: Gradually, Then Suddenly: Bitcoin Is Antifragile
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-antifragile/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-antifragile/ on 2026-10-22 (gts, bitcoin-is-antifragile.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 379. Parker Lewis (2023)

> The more people that value the long-term stability bitcoin provides, the more energy the network will consume in total.

- Source: Gradually, Then Suddenly: Bitcoin Does Not Waste Energy
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-does-not-waste-energy/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-does-not-waste-energy/ on 2026-10-22 (gts, bitcoin-does-not-waste-energy.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 380. Parker Lewis (2023)

> The most powerful players in bitcoin colluded, yet failed to co-opt the network because of decentralization.

- Source: Gradually, Then Suddenly: Bitcoin Is Antifragile
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-antifragile/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-antifragile/ on 2026-10-22 (gts, bitcoin-is-antifragile.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 381. Parker Lewis (2023)

> The network's demonstration of resilience and immunity reinforces trust in the network, which drives incremental adoption and makes bitcoin more resistant to future attacks or individual errors.

- Source: Gradually, Then Suddenly: Bitcoin Is Antifragile
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-antifragile/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-antifragile/ on 2026-10-22 (gts, bitcoin-is-antifragile.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 382. Parker Lewis (2023)

> The only value bitcoin can ultimately provide is through present or future exchange.

- Source: Gradually, Then Suddenly: Bitcoin, Not Blockchain
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-not-blockchain/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-not-blockchain/ on 2026-10-22 (gts, bitcoin-not-blockchain.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 383. Parker Lewis (2023)

> The playbook is as follows: increase the money supply, reduce interest rates, manufacture price inflation, and reflate asset values such that existing debt levels can be sustained and more debt can be created.

- Source: Gradually, Then Suddenly: Bitcoin Fixes This
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-fixes-this/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-fixes-this/ on 2026-10-22 (gts, bitcoin-fixes-this.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 384. Parker Lewis (2023)

> The process of definancialization will occur as wealth stored in financial assets is converted to bitcoin, specifically as each market participant increasingly chooses to hold a more reliable form of money over risk assets.

- Source: Gradually, Then Suddenly: Bitcoin Is the Great Definancialization
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-the-great-definancialization/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-the-great-definancialization/ on 2026-10-22 (gts, bitcoin-is-the-great-definancialization.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 385. Parker Lewis (2023)

> The risk inherent in even the possibility of hyperinflation is so negatively asymmetric that the price of bitcoin's energy consumption is of small relative cost.

- Source: Gradually, Then Suddenly: Bitcoin Does Not Waste Energy
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-does-not-waste-energy/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-does-not-waste-energy/ on 2026-10-22 (gts, bitcoin-does-not-waste-energy.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 386. Parker Lewis (2023)

> The skeptic's logic is as follows: bitcoin does not work, and if it does, the government will ban it.

- Source: Gradually, Then Suddenly: Bitcoin Cannot Be Banned
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-banned/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-banned/ on 2026-10-22 (gts, bitcoin-cannot-be-banned.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 387. Parker Lewis (2023)

> The stock market and national average home values are back at all-time highs while tens of millions of Americans are filing for unemployment and half of society has practically no savings.

- Source: Gradually, Then Suddenly: Bitcoin Is One for All
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-one-for-all/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-one-for-all/ on 2026-10-22 (gts, bitcoin-is-one-for-all.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 388. Parker Lewis (2023)

> The unhealthy part is specifically when individuals are forced (consciously or not) into taking risk as a byproduct of central banks manufacturing money to lose value.

- Source: Gradually, Then Suddenly: Bitcoin Is the Great Definancialization
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-the-great-definancialization/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-the-great-definancialization/ on 2026-10-22 (gts, bitcoin-is-the-great-definancialization.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 389. Parker Lewis (2023)

> The value of bitcoin is derived from its ability to secure each of these functions on a decentralized, trustless basis, and both are inextricably linked to the bitcoin network's limited transaction capacity.

- Source: Gradually, Then Suddenly: Bitcoin Is Not Too Slow
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-slow/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-too-slow/ on 2026-10-22 (gts, bitcoin-is-not-too-slow.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 390. Parker Lewis (2023)

> The very idea of freedom may be the single most important tenet underpinning the monetary revolution to which bitcoin is giving rise.

- Source: Gradually, Then Suddenly: Bitcoin Is a Rally Cry
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-a-rally-cry/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-a-rally-cry/ on 2026-10-22 (gts, bitcoin-is-a-rally-cry.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 391. Parker Lewis (2023)

> The world is converging on bitcoin because it is finitely scarce and capable of facilitating direct commerce by and between the largest number of people relative to any other currency system given its permissionless nature.

- Source: Gradually, Then Suddenly: Conclusion
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/conclusion/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/conclusion/ on 2026-10-22 (gts, conclusion.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 392. Parker Lewis (2023)

> There is no central bank to arbitrarily increase the supply of the currency and debase savings.

- Source: Gradually, Then Suddenly: Bitcoin Is the Great Definancialization
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-the-great-definancialization/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-the-great-definancialization/ on 2026-10-22 (gts, bitcoin-is-the-great-definancialization.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 393. Parker Lewis (2023)

> There is no comparison between such a world and one where individuals can earn money honestly by producing value for others and are free to determine how best to allocate it for value in the future.

- Source: Gradually, Then Suddenly: Bitcoin Is One for All
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-one-for-all/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-one-for-all/ on 2026-10-22 (gts, bitcoin-is-one-for-all.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 394. Parker Lewis (2023)

> Through this consensus mechanism, bitcoin dispenses with the need for the conscious control of central bankers, relying instead on the distributed knowledge of all market participants.

- Source: Gradually, Then Suddenly: Bitcoin Fixes This
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-fixes-this/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-fixes-this/ on 2026-10-22 (gts, bitcoin-fixes-this.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 395. Parker Lewis (2023)

> What they seemingly understood was that there was sufficient market demand for bitcoin to make it viable as a medium of exchange.

- Source: Gradually, Then Suddenly: Bitcoin Is Not for Criminals
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-for-criminals/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-for-criminals/ on 2026-10-22 (gts, bitcoin-is-not-for-criminals.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 396. Parker Lewis (2023)

> When governments and central banks can no longer create money out of thin air, it will become crystal clear that backdoor monetary inflation was always just a ruse to allocate resources for which no one was actually willing to be taxed.

- Source: Gradually, Then Suddenly: Bitcoin Is Common Sense
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-common-sense/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-common-sense/ on 2026-10-22 (gts, bitcoin-is-common-sense.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 397. Parker Lewis (2023)

> When the credit system attempts to contract, it represents the market and the individuals within an economy working to eliminate imbalances that exist.

- Source: Gradually, Then Suddenly: Bitcoin Is Common Sense
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-common-sense/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-common-sense/ on 2026-10-22 (gts, bitcoin-is-common-sense.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 398. Parker Lewis (2023)

> When the war is won, bitcoin will likely find its way into a constitutional amendment even though the first amendment already covers it---the right of the people to keep and bear bitcoin.

- Source: Gradually, Then Suddenly: Bitcoin Is a Rally Cry
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-a-rally-cry/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-a-rally-cry/ on 2026-10-22 (gts, bitcoin-is-a-rally-cry.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 399. Parker Lewis (2023)

> While bitcoin is valued for different reasons, it consistently appeals to those that have identified the inherent level of freedom afforded by such a powerful tool, particularly in a world full of never-ending economic calamities.

- Source: Gradually, Then Suddenly: Bitcoin Is a Rally Cry
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-a-rally-cry/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-a-rally-cry/ on 2026-10-22 (gts, bitcoin-is-a-rally-cry.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 400. Parker Lewis (2023)

> While many people choose to trust a bank-like entity, the security model of bitcoin is unique.

- Source: Gradually, Then Suddenly: Bitcoin Is Not Backed by Nothing
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-backed-by-nothing/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-backed-by-nothing/ on 2026-10-22 (gts, bitcoin-is-not-backed-by-nothing.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 401. Parker Lewis (2023)

> While the supply of bitcoin remains fixed and finitely scarce, central banks will be forced to create more money in order to sustain the legacy credit system.

- Source: Gradually, Then Suddenly: Bitcoin Is Not Backed by Nothing
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-backed-by-nothing/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-not-backed-by-nothing/ on 2026-10-22 (gts, bitcoin-is-not-backed-by-nothing.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 402. Parker Lewis (2023)

> With bitcoin as a backdrop, it becomes self-evident that there is no advantage in ceding the power to print money or allowing a central bank to allocate resources within an economy in place of the individuals who comprise it.

- Source: Gradually, Then Suddenly: Bitcoin Is Common Sense
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-common-sense/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-is-common-sense/ on 2026-10-22 (gts, bitcoin-is-common-sense.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 403. Parker Lewis (2023)

> Would bitcoin be functional as money on a standalone basis if left to the free market?

- Source: Gradually, Then Suddenly: Bitcoin Cannot Be Banned
- URL: https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-banned/
- Verified: Fetched https://nakamotoinstitute.org/library/gradually-then-suddenly/bitcoin-cannot-be-banned/ on 2026-10-22 (gts, bitcoin-cannot-be-banned.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 404. Paul Krugman (2013)

> To be successful, money must be both a medium of exchange and a reasonably stable store of value. And it remains completely unclear why BitCoin should be a stable store of value.

- Source: Bitcoin Is Evil (New York Times)
- URL: https://archive.nytimes.com/krugman.blogs.nytimes.com/2013/12/28/bitcoin-is-evil/
- Verified: Fetched the NYT archive copy of the 28 Dec 2013 blog post on 2026-10-22. His spelling "BitCoin" is kept. The Brad DeLong and Charlie Stross passages that follow are not attributed to him.

### 405. Philip R. Zimmermann (1991)

> At no time in the past century has public distrust of the government been so broadly distributed across the political spectrum, as it is today.

- Source: Why I Wrote PGP
- URL: https://nakamotoinstitute.org/library/why-i-wrote-pgp/
- Verified: Fetched https://nakamotoinstitute.org/library/why-i-wrote-pgp/ on 2026-10-22 (library-html, why-i-wrote-pgp.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 406. Philip R. Zimmermann (1991)

> The catch: At the time of manufacture, each Clipper chip is loaded with its own unique key, and the government gets to keep a copy, placed in escrow.

- Source: Why I Wrote PGP
- URL: https://nakamotoinstitute.org/library/why-i-wrote-pgp/
- Verified: Fetched https://nakamotoinstitute.org/library/why-i-wrote-pgp/ on 2026-10-22 (library-html, why-i-wrote-pgp.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 407. Philip R. Zimmermann (1991)

> The government initially claimed that using Clipper would be voluntary, that no one would be forced to use it instead of other types of cryptography.

- Source: Why I Wrote PGP
- URL: https://nakamotoinstitute.org/library/why-i-wrote-pgp/
- Verified: Fetched https://nakamotoinstitute.org/library/why-i-wrote-pgp/ on 2026-10-22 (library-html, why-i-wrote-pgp.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 408. Philip R. Zimmermann (1991)

> The government knows what a pivotal role cryptography is destined to play in the power relationship with its people.

- Source: Why I Wrote PGP
- URL: https://nakamotoinstitute.org/library/why-i-wrote-pgp/
- Verified: Fetched https://nakamotoinstitute.org/library/why-i-wrote-pgp/ on 2026-10-22 (library-html, why-i-wrote-pgp.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 409. Philip R. Zimmermann (1991)

> The only way to hold the line on privacy in the information age is strong cryptography.

- Source: Why I Wrote PGP
- URL: https://nakamotoinstitute.org/library/why-i-wrote-pgp/
- Verified: Fetched https://nakamotoinstitute.org/library/why-i-wrote-pgp/ on 2026-10-22 (library-html, why-i-wrote-pgp.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 410. Philip R. Zimmermann (1991)

> The right to a private conversation was a natural right, not just in a philosophical sense, but in a law-of-physics sense, given the technology of the time.

- Source: Why I Wrote PGP
- URL: https://nakamotoinstitute.org/library/why-i-wrote-pgp/
- Verified: Fetched https://nakamotoinstitute.org/library/why-i-wrote-pgp/ on 2026-10-22 (library-html, why-i-wrote-pgp.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 411. Philip R. Zimmermann (1991)

> Throughout the 1990s, I figured that if we want to resist this unsettling trend in the government to outlaw cryptography, one measure we can apply is to use cryptography as much as we can now while it's still legal.

- Source: Why I Wrote PGP
- URL: https://nakamotoinstitute.org/library/why-i-wrote-pgp/
- Verified: Fetched https://nakamotoinstitute.org/library/why-i-wrote-pgp/ on 2026-10-22 (library-html, why-i-wrote-pgp.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 412. Philip R. Zimmermann (1991)

> When use of strong cryptography becomes popular, it's harder for the government to criminalize it.

- Source: Why I Wrote PGP
- URL: https://nakamotoinstitute.org/library/why-i-wrote-pgp/
- Verified: Fetched https://nakamotoinstitute.org/library/why-i-wrote-pgp/ on 2026-10-22 (library-html, why-i-wrote-pgp.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 413. Philipp Bagus (2009)

> In a fiat paper standard the bankruptcy or the end of the government likely means the end of the currency and renders it worthless.

- Source: The Quality of Money
- URL: https://nakamotoinstitute.org/library/the-quality-of-money/
- Verified: Fetched https://nakamotoinstitute.org/library/the-quality-of-money/ on 2026-10-22 (library-html, the-quality-of-money.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 414. Philipp Bagus (2009)

> The assets of a central bank can be used to defend the value of a currency internally and externally.

- Source: The Quality of Money
- URL: https://nakamotoinstitute.org/library/the-quality-of-money/
- Verified: Fetched https://nakamotoinstitute.org/library/the-quality-of-money/ on 2026-10-22 (library-html, the-quality-of-money.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 415. Philipp Bagus (2009)

> The taxation capacity is crucial, because a fiat paper money is backed by the reserves of the banking system and central bank, which are largely government debts.

- Source: The Quality of Money
- URL: https://nakamotoinstitute.org/library/the-quality-of-money/
- Verified: Fetched https://nakamotoinstitute.org/library/the-quality-of-money/ on 2026-10-22 (library-html, the-quality-of-money.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 416. Philipp Bagus (2009)

> When government debts become worthless because of an end of government due to war or revolution, the fiat money will also lose in value and may cease to exist.

- Source: The Quality of Money
- URL: https://nakamotoinstitute.org/library/the-quality-of-money/
- Verified: Fetched https://nakamotoinstitute.org/library/the-quality-of-money/ on 2026-10-22 (library-html, the-quality-of-money.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 417. Philipp Bagus (2009)

> When people start to value money higher, the purchasing power of money will be higher.

- Source: The Quality of Money
- URL: https://nakamotoinstitute.org/library/the-quality-of-money/
- Verified: Fetched https://nakamotoinstitute.org/library/the-quality-of-money/ on 2026-10-22 (library-html, the-quality-of-money.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 418. Pierre Rochard (2014)

> Bitcoins will have to reach certain threshold of liquidity, indicated by a solid exchange in every financial center and a real money supply – i.e. market cap – of at least $50 billion, before they can be used as an instrument in a speculative attack.

- Source: Speculative Attack
- URL: https://nakamotoinstitute.org/mempool/speculative-attack/
- Verified: Fetched https://nakamotoinstitute.org/mempool/speculative-attack/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 419. Pierre Rochard (2014)

> People will be forced to pay with bitcoins, not because of 'the technology', but because no one will accept their worthless fiat for payments.

- Source: Speculative Attack
- URL: https://nakamotoinstitute.org/mempool/speculative-attack/
- Verified: Fetched https://nakamotoinstitute.org/mempool/speculative-attack/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 420. Pierre Rochard (2014)

> Slow bleed leads to currency crisis as the expected value of bitcoins solidifies in people's minds.

- Source: Speculative Attack
- URL: https://nakamotoinstitute.org/mempool/speculative-attack/
- Verified: Fetched https://nakamotoinstitute.org/mempool/speculative-attack/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 421. Pierre Rochard (2014)

> The effect of people, businesses, or financial institutions borrowing their local currency to buy bitcoins is that the bitcoin price in that currency would go up relative to other currencies.

- Source: Speculative Attack
- URL: https://nakamotoinstitute.org/mempool/speculative-attack/
- Verified: Fetched https://nakamotoinstitute.org/mempool/speculative-attack/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 422. Pierre Rochard (2014)

> The price of bitcoins in Indian Rupees goes up, a premium develops relative to other currency pairs.

- Source: Speculative Attack
- URL: https://nakamotoinstitute.org/mempool/speculative-attack/
- Verified: Fetched https://nakamotoinstitute.org/mempool/speculative-attack/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 423. Pierre Rochard (2014)

> There's a huge problem with the Indian central bank raising interest rates: bitcoin's historical return is ~500% per year.

- Source: Speculative Attack
- URL: https://nakamotoinstitute.org/mempool/speculative-attack/
- Verified: Fetched https://nakamotoinstitute.org/mempool/speculative-attack/ on 2026-10-22. Took a sentence from the author's own paragraph (blockquote quotes of other people were skipped). Normalized whitespace and quotes. Exact substring match.

### 424. Richard M. Stallman (1985)

> In the long run, making programs free is a step toward the postscarcity world, where nobody will have to work very hard just to make a living.

- Source: The GNU Manifesto
- URL: https://nakamotoinstitute.org/library/the-gnu-manifesto/
- Verified: Fetched https://nakamotoinstitute.org/library/the-gnu-manifesto/ on 2026-10-22 (library-html, the-gnu-manifesto.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 425. Richard M. Stallman (1985)

> The expression "give away" is another indication that I had not yet clearly separated the issue of price from that of freedom.

- Source: The GNU Manifesto
- URL: https://nakamotoinstitute.org/library/the-gnu-manifesto/
- Verified: Fetched https://nakamotoinstitute.org/library/the-gnu-manifesto/ on 2026-10-22 (library-html, the-gnu-manifesto.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 426. Richard M. Stallman (1985)

> The salary won't be high by programmers' standards, but I'm looking for people for whom building community spirit is as important as making money.

- Source: The GNU Manifesto
- URL: https://nakamotoinstitute.org/library/the-gnu-manifesto/
- Verified: Fetched https://nakamotoinstitute.org/library/the-gnu-manifesto/ on 2026-10-22 (library-html, the-gnu-manifesto.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 427. Richard M. Stallman (1997)

> In France, under the DADVSI law adopted in 2006, mere possession of a copy of DeCSS, the free program to decrypt video on a DVD, is a crime.

- Source: The Right to Read: A Dystopian Short Story
- URL: https://nakamotoinstitute.org/library/right-to-read/
- Verified: Fetched https://nakamotoinstitute.org/library/right-to-read/ on 2026-10-22 (library-html, right-to-read.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 428. Richard M. Stallman (1997)

> The FTAA is one of the so-called free trade treaties, which are actually designed to give business increased power over democratic governments; imposing laws like the DMCA is typical of this spirit.

- Source: The Right to Read: A Dystopian Short Story
- URL: https://nakamotoinstitute.org/library/right-to-read/
- Verified: Fetched https://nakamotoinstitute.org/library/right-to-read/ on 2026-10-22 (library-html, right-to-read.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 429. Richard M. Stallman (1997)

> Their mission is to preserve, protect and promote the freedom to use, study, copy, modify, and redistribute computer software, and to defend the rights of Free Software users.

- Source: The Right to Read: A Dystopian Short Story
- URL: https://nakamotoinstitute.org/library/right-to-read/
- Verified: Fetched https://nakamotoinstitute.org/library/right-to-read/ on 2026-10-22 (library-html, right-to-read.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 430. Richard M. Stallman (1997)

> There were even free debugging tools available on CD or downloadable over the net.

- Source: The Right to Read: A Dystopian Short Story
- URL: https://nakamotoinstitute.org/library/right-to-read/
- Verified: Fetched https://nakamotoinstitute.org/library/right-to-read/ on 2026-10-22 (library-html, right-to-read.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 431. Satoshi Nakamoto (2008)

> As computers get faster and the total computing power applied to creating bitcoins increases, the difficulty increases proportionally to keep the total new production constant.

- Source: Bitcoin P2P e-cash paper
- URL: https://satoshi.nakamotoinstitute.org/emails/cryptography/5/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/emails/cryptography/5/ on 2026-10-22 (satoshi-post, emails_cryptography_5_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 432. Satoshi Nakamoto (2008)

> As such, the verification is reliable as long as honest nodes control the network, but is more vulnerable if the network is overpowered by an attacker.

- Source: Bitcoin: A Peer-to-Peer Electronic Cash System
- URL: https://nakamotoinstitute.org/library/bitcoin/
- Verified: Fetched https://nakamotoinstitute.org/library/bitcoin/ on 2026-10-22 (library-html, bitcoin.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 433. Satoshi Nakamoto (2008)

> Every general, just by verifying the difficulty of the proof-of-work chain, can estimate how much parallel CPU power per hour was expended on it and see that it must have required the majority of the computers to produce that much proof-of-work in the allotted time.

- Source: Bitcoin P2P e-cash paper
- URL: https://satoshi.nakamotoinstitute.org/emails/cryptography/11/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/emails/cryptography/11/ on 2026-10-22 (satoshi-post, emails_cryptography_11_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 434. Satoshi Nakamoto (2008)

> For our timestamp network, we implement the proof-of-work by incrementing a nonce in the block until a value is found that gives the block's hash the required zero bits.

- Source: Bitcoin: A Peer-to-Peer Electronic Cash System
- URL: https://nakamotoinstitute.org/library/bitcoin/
- Verified: Fetched https://nakamotoinstitute.org/library/bitcoin/ on 2026-10-22 (library-html, bitcoin.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 435. Satoshi Nakamoto (2008)

> Governments are good at cutting off the heads of a centrally controlled networks like Napster, but pure P2P networks like Gnutella and Tor seem to be holding their own.

- Source: Bitcoin P2P e-cash paper
- URL: https://satoshi.nakamotoinstitute.org/emails/cryptography/4/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/emails/cryptography/4/ on 2026-10-22 (satoshi-post, emails_cryptography_4_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 436. Satoshi Nakamoto (2008)

> I don't think he could make as much money trying to pull a carding scheme like that as he could by generating bitcoins.

- Source: Bitcoin P2P e-cash paper
- URL: https://satoshi.nakamotoinstitute.org/emails/cryptography/3/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/emails/cryptography/3/ on 2026-10-22 (satoshi-post, emails_cryptography_3_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 437. Satoshi Nakamoto (2008)

> I've been working on a new electronic cash system that's fully peer-to-peer, with no trusted third party.

- Source: Bitcoin P2P e-cash paper
- URL: https://satoshi.nakamotoinstitute.org/emails/cryptography/1/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/emails/cryptography/1/ on 2026-10-22 (satoshi-post, emails_cryptography_1_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 438. Satoshi Nakamoto (2008)

> If a greedy attacker is able to assemble more CPU power than all the honest nodes, he would have to choose between using it to defraud people by stealing back his payments, or using it to generate new coins.

- Source: Bitcoin: A Peer-to-Peer Electronic Cash System
- URL: https://nakamotoinstitute.org/library/bitcoin/
- Verified: Fetched https://nakamotoinstitute.org/library/bitcoin/ on 2026-10-22 (library-html, bitcoin.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 439. Satoshi Nakamoto (2008)

> If anyone was working on a different attack time, they switch to this one, because its proof-of-work chain is now longer.

- Source: Bitcoin P2P e-cash paper
- URL: https://satoshi.nakamotoinstitute.org/emails/cryptography/11/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/emails/cryptography/11/ on 2026-10-22 (satoshi-post, emails_cryptography_11_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 440. Satoshi Nakamoto (2008)

> If it does not increase as fast as demand, there will be deflation and early holders of money will see its value increase.

- Source: Bitcoin P2P e-cash paper
- URL: https://satoshi.nakamotoinstitute.org/emails/cryptography/5/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/emails/cryptography/5/ on 2026-10-22 (satoshi-post, emails_cryptography_5_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 441. Satoshi Nakamoto (2008)

> If the CPU power exhibited by the proof-of-work chain is sufficient to crack the password, they can safely attack at the agreed time.

- Source: Bitcoin P2P e-cash paper
- URL: https://satoshi.nakamotoinstitute.org/emails/cryptography/11/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/emails/cryptography/11/ on 2026-10-22 (satoshi-post, emails_cryptography_11_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 442. Satoshi Nakamoto (2008)

> If the supply of money increases at the same rate that the number of people using it increases, prices remain stable.

- Source: Bitcoin P2P e-cash paper
- URL: https://satoshi.nakamotoinstitute.org/emails/cryptography/5/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/emails/cryptography/5/ on 2026-10-22 (satoshi-post, emails_cryptography_5_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 443. Satoshi Nakamoto (2008)

> If the timespan over the last 6*24*30 blocks is less than 15 days, blocks are being generated too fast and the proof-of-work difficulty doubles.

- Source: Bitcoin P2P e-cash paper
- URL: https://satoshi.nakamotoinstitute.org/emails/cryptography/10/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/emails/cryptography/10/ on 2026-10-22 (satoshi-post, emails_cryptography_10_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 444. Satoshi Nakamoto (2008)

> Once a predetermined number of coins have entered circulation, the incentive can transition entirely to transaction fees and be completely inflation free.

- Source: Bitcoin: A Peer-to-Peer Electronic Cash System
- URL: https://nakamotoinstitute.org/library/bitcoin/
- Verified: Fetched https://nakamotoinstitute.org/library/bitcoin/ on 2026-10-22 (library-html, bitcoin.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 445. Satoshi Nakamoto (2008)

> Once each general receives whatever attack time he hears first, he sets his computer to solve an extremely difficult proof-of-work problem that includes the attack time in its hash.

- Source: Bitcoin P2P e-cash paper
- URL: https://satoshi.nakamotoinstitute.org/emails/cryptography/11/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/emails/cryptography/11/ on 2026-10-22 (satoshi-post, emails_cryptography_11_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 446. Satoshi Nakamoto (2008)

> The Bitcoin network might actually reduce spam by diverting zombie farms to generating bitcoins instead.

- Source: Bitcoin P2P e-cash paper
- URL: https://satoshi.nakamotoinstitute.org/emails/cryptography/3/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/emails/cryptography/3/ on 2026-10-22 (satoshi-post, emails_cryptography_3_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 447. Satoshi Nakamoto (2008)

> The fact that new coins are produced means the money supply increases by a planned amount, but this does not necessarily result in inflation.

- Source: Bitcoin P2P e-cash paper
- URL: https://satoshi.nakamotoinstitute.org/emails/cryptography/5/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/emails/cryptography/5/ on 2026-10-22 (satoshi-post, emails_cryptography_5_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 448. Satoshi Nakamoto (2008)

> The incentive value when a node finds a proof-of-work for a block could be the total of the fees in the block.

- Source: Bitcoin P2P e-cash paper
- URL: https://satoshi.nakamotoinstitute.org/emails/cryptography/9/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/emails/cryptography/9/ on 2026-10-22 (satoshi-post, emails_cryptography_9_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 449. Satoshi Nakamoto (2008)

> The network timestamps transactions by hashing them into an ongoing chain of hash-based proof-of-work, forming a record that cannot be changed without redoing the proof-of-work.

- Source: Bitcoin: A Peer-to-Peer Electronic Cash System
- URL: https://nakamotoinstitute.org/library/bitcoin/
- Verified: Fetched https://nakamotoinstitute.org/library/bitcoin/ on 2026-10-22 (library-html, bitcoin.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 450. Satoshi Nakamoto (2008)

> The proof-of-work also solves the problem of determining representation in majority decision making.

- Source: Bitcoin: A Peer-to-Peer Electronic Cash System
- URL: https://nakamotoinstitute.org/library/bitcoin/
- Verified: Fetched https://nakamotoinstitute.org/library/bitcoin/ on 2026-10-22 (library-html, bitcoin.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 451. Satoshi Nakamoto (2008)

> The proof-of-work for new coin generation also powers the network to prevent double-spending.

- Source: Bitcoin P2P e-cash paper
- URL: https://satoshi.nakamotoinstitute.org/emails/cryptography/1/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/emails/cryptography/1/ on 2026-10-22 (satoshi-post, emails_cryptography_1_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 452. Satoshi Nakamoto (2008)

> The proof-of-work involves scanning for a value that when hashed, such as with SHA-256, the hash begins with a number of zero bits.

- Source: Bitcoin: A Peer-to-Peer Electronic Cash System
- URL: https://nakamotoinstitute.org/library/bitcoin/
- Verified: Fetched https://nakamotoinstitute.org/library/bitcoin/ on 2026-10-22 (library-html, bitcoin.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 453. Satoshi Nakamoto (2008)

> The traditional banking model achieves a level of privacy by limiting access to information to the parties involved and the trusted third party.

- Source: Bitcoin: A Peer-to-Peer Electronic Cash System
- URL: https://nakamotoinstitute.org/library/bitcoin/
- Verified: Fetched https://nakamotoinstitute.org/library/bitcoin/ on 2026-10-22 (library-html, bitcoin.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 454. Satoshi Nakamoto (2008)

> There would be many smaller zombie farms that are not big enough to overpower the network, and they could still make money by generating bitcoins.

- Source: Bitcoin P2P e-cash paper
- URL: https://satoshi.nakamotoinstitute.org/emails/cryptography/3/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/emails/cryptography/3/ on 2026-10-22 (satoshi-post, emails_cryptography_3_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 455. Satoshi Nakamoto (2008)

> To exploit it, he would have to buy something from a merchant, wait till it ships, then overpower the network and try to take his money back.

- Source: Bitcoin P2P e-cash paper
- URL: https://satoshi.nakamotoinstitute.org/emails/cryptography/3/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/emails/cryptography/3/ on 2026-10-22 (satoshi-post, emails_cryptography_3_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 456. Satoshi Nakamoto (2009)

> A lot of people automatically dismiss e-currency as a lost cause because of all the companies that failed since the 1990's.

- Source: Bitcoin open source implementation of P2P currency
- URL: https://satoshi.nakamotoinstitute.org/posts/p2pfoundation/2/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/p2pfoundation/2/ on 2026-10-22 (satoshi-post, posts_p2pfoundation_2_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 457. Satoshi Nakamoto (2009)

> Announcing the first release of Bitcoin, a new electronic cash system that uses a peer-to-peer network to prevent double-spending.

- Source: Bitcoin v0.1 released
- URL: https://satoshi.nakamotoinstitute.org/emails/cryptography/16/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/emails/cryptography/16/ on 2026-10-22 (satoshi-post, emails_cryptography_16_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 458. Satoshi Nakamoto (2009)

> Banks must be trusted to hold our money and transfer it electronically, but they lend it out in waves of credit bubbles with barely a fraction in reserve.

- Source: Bitcoin open source implementation of P2P currency
- URL: https://satoshi.nakamotoinstitute.org/posts/p2pfoundation/1/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/p2pfoundation/1/ on 2026-10-22 (satoshi-post, posts_p2pfoundation_1_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 459. Satoshi Nakamoto (2009)

> Bitcoin's solution is to use a peer-to-peer network to check for double-spending.

- Source: Bitcoin open source implementation of P2P currency
- URL: https://satoshi.nakamotoinstitute.org/posts/p2pfoundation/1/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/p2pfoundation/1/ on 2026-10-22 (satoshi-post, posts_p2pfoundation_1_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 460. Satoshi Nakamoto (2009)

> I think this is the first time we're trying a decentralized, non-trust-based system.

- Source: Bitcoin open source implementation of P2P currency
- URL: https://satoshi.nakamotoinstitute.org/posts/p2pfoundation/2/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/p2pfoundation/2/ on 2026-10-22 (satoshi-post, posts_p2pfoundation_2_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 461. Satoshi Nakamoto (2009)

> If someone famous is getting more e-mail than they can read, but would still like to have a way for fans to contact them, they could set up Bitcoin and give out the IP address on their website.

- Source: Bitcoin v0.1 released
- URL: https://satoshi.nakamotoinstitute.org/emails/cryptography/17/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/emails/cryptography/17/ on 2026-10-22 (satoshi-post, emails_cryptography_17_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 462. Satoshi Nakamoto (2009)

> In a nutshell, the network works like a distributed timestamp server, stamping the first transaction to spend a coin.

- Source: Bitcoin open source implementation of P2P currency
- URL: https://satoshi.nakamotoinstitute.org/posts/p2pfoundation/1/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/p2pfoundation/1/ on 2026-10-22 (satoshi-post, posts_p2pfoundation_1_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 463. Satoshi Nakamoto (2009)

> It might make sense just to get some in case it catches on.

- Source: Cryptography mailing list: Bitcoin v0.1 released
- URL: https://satoshi.nakamotoinstitute.org/emails/cryptography/17/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/emails/cryptography/17/ on 2026-10-22. The sentence is in the v0.1 announcement. A later essay quotes it; this URL is Satoshi's own email.

### 464. Satoshi Nakamoto (2009)

> It's the opposite of when a government prints money and the value of existing money goes down.

- Source: Re: Questions about Bitcoin
- URL: https://satoshi.nakamotoinstitute.org/posts/bitcointalk/17/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/bitcointalk/17/ on 2026-10-22 (satoshi-post, posts_bitcointalk_17_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 465. Satoshi Nakamoto (2009)

> Subscription sites that need some extra proof-of-work for their free trial so it doesn't cannibalize subscriptions could charge bitcoins for the trial.

- Source: Bitcoin v0.1 released
- URL: https://satoshi.nakamotoinstitute.org/emails/cryptography/17/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/emails/cryptography/17/ on 2026-10-22 (satoshi-post, emails_cryptography_17_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 466. Satoshi Nakamoto (2009)

> The central bank must be trusted not to debase the currency, but the history of fiat currencies is full of breaches of that trust.

- Source: Bitcoin open source implementation of P2P currency
- URL: https://satoshi.nakamotoinstitute.org/posts/p2pfoundation/1/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/p2pfoundation/1/ on 2026-10-22 (satoshi-post, posts_p2pfoundation_1_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 467. Satoshi Nakamoto (2009)

> The root problem with conventional currency is all the trust that's required to make it work.

- Source: Bitcoin open source implementation of P2P currency
- URL: https://satoshi.nakamotoinstitute.org/posts/p2pfoundation/1/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/p2pfoundation/1/ on 2026-10-22 (satoshi-post, posts_p2pfoundation_1_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 468. Satoshi Nakamoto (2009)

> The Times 03/Jan/2009 Chancellor on brink of second bailout for banks

- Source: Bitcoin source: genesis block timestamp
- URL: https://github.com/bitcoin/bitcoin/blob/v28.0/src/kernel/chainparams.cpp#L73
- Verified: Fetched https://raw.githubusercontent.com/bitcoin/bitcoin/v28.0/src/kernel/chainparams.cpp on 2026-10-22. The string is the pszTimestamp constant. Linked from the matching GitHub line. No period was added.

### 469. Satoshi Nakamoto (2009)

> To Sepp's question, indeed there is nobody to act as central bank or federal reserve to adjust the money supply as the population of users grows.

- Source: Bitcoin open source implementation of P2P currency
- URL: https://satoshi.nakamotoinstitute.org/posts/p2pfoundation/3/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/p2pfoundation/3/ on 2026-10-22 (satoshi-post, posts_p2pfoundation_3_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 470. Satoshi Nakamoto (2009)

> We have to trust them with our privacy, trust them not to let identity thieves drain our accounts.

- Source: Bitcoin open source implementation of P2P currency
- URL: https://satoshi.nakamotoinstitute.org/posts/p2pfoundation/1/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/p2pfoundation/1/ on 2026-10-22 (satoshi-post, posts_p2pfoundation_1_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 471. Satoshi Nakamoto (2009)

> With e-currency based on cryptographic proof, without the need to trust a third party middleman, money can be secure and transactions effortless.

- Source: Bitcoin open source implementation of P2P currency
- URL: https://satoshi.nakamotoinstitute.org/posts/p2pfoundation/1/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/p2pfoundation/1/ on 2026-10-22 (satoshi-post, posts_p2pfoundation_1_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 472. Satoshi Nakamoto (2010)

> A rational market price for something that is expected to increase in value will already reflect the present value of the expected future increases.

- Source: Re: Current Bitcoin economic model is unsustainable
- URL: https://satoshi.nakamotoinstitute.org/posts/bitcointalk/65/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/bitcointalk/65/ on 2026-10-22 (satoshi-post, posts_bitcointalk_65_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 473. Satoshi Nakamoto (2010)

> As the price keeps going up and up, some people keep holding out for yet higher prices and refuse to sell.

- Source: Re: BTC Vulnerability? (Massive Attack against BTC system. Is it really?)
- URL: https://satoshi.nakamotoinstitute.org/posts/bitcointalk/174/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/bitcointalk/174/ on 2026-10-22 (satoshi-post, posts_bitcointalk_174_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 474. Satoshi Nakamoto (2010)

> At the moment, generation effort is rapidly increasing, suggesting people are estimating the present value to be higher than the current cost of production.

- Source: Re: Current Bitcoin economic model is unsustainable
- URL: https://satoshi.nakamotoinstitute.org/posts/bitcointalk/65/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/bitcointalk/65/ on 2026-10-22 (satoshi-post, posts_bitcointalk_65_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 475. Satoshi Nakamoto (2010)

> At the same time, the increased production would increase the difficulty, pushing the cost of generating towards the price.

- Source: Re: Current Bitcoin economic model is unsustainable
- URL: https://satoshi.nakamotoinstitute.org/posts/bitcointalk/65/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/bitcointalk/65/ on 2026-10-22 (satoshi-post, posts_bitcointalk_65_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 476. Satoshi Nakamoto (2010)

> Bitcoin is a digital currency using cryptography and a distributed network to replace the need for a trusted central server.

- Source: Bitcoin 0.3 released!
- URL: https://satoshi.nakamotoinstitute.org/posts/bitcointalk/168/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/bitcointalk/168/ on 2026-10-22 (satoshi-post, posts_bitcointalk_168_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 477. Satoshi Nakamoto (2010)

> Bitcoin is practical for smaller transactions than are practical with existing payment methods.

- Source: Re: Flood attack 0.00000001 BC
- URL: https://satoshi.nakamotoinstitute.org/posts/bitcointalk/317/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/bitcointalk/317/ on 2026-10-22 (satoshi-post, posts_bitcointalk_317_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 478. Satoshi Nakamoto (2010)

> Bitcoin would be convenient for people who don't have a credit card or don't want to use the cards they have, either don't want the spouse to see it on the bill or don't trust giving their number to "porn guys", or afraid of recurring billing.

- Source: Re: Porn
- URL: https://satoshi.nakamotoinstitute.org/posts/bitcointalk/460/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/bitcointalk/460/ on 2026-10-22 (satoshi-post, posts_bitcointalk_460_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 479. Satoshi Nakamoto (2010)

> Bitcoins have no dividend or potential future dividend, therefore not like a stock.

- Source: Re: Bitcoins are most like shares of common stock
- URL: https://satoshi.nakamotoinstitute.org/posts/bitcointalk/427/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/bitcointalk/427/ on 2026-10-22 (satoshi-post, posts_bitcointalk_427_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 480. Satoshi Nakamoto (2010)

> Gold mining is a waste, but that waste is far less than the utility of having gold available as a medium of exchange.

- Source: Re: Bitcoin minting is thermodynamically perverse
- URL: https://satoshi.nakamotoinstitute.org/posts/bitcointalk/327/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/bitcointalk/327/ on 2026-10-22 (satoshi-post, posts_bitcointalk_327_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 481. Satoshi Nakamoto (2010)

> If you don't believe me or don't get it, I don't have time to try to convince you, sorry.

- Source: BitcoinTalk: Scalability
- URL: https://bitcointalk.org/index.php?topic=532.msg6306#msg6306
- Verified: Fetched https://bitcointalk.org/index.php?topic=532.msg6306#msg6306 on 2026-10-22. Exact substring after whitespace and quote normalization. Replaces the old card line that said "believe it" and "the time", which is not what he wrote.

### 482. Satoshi Nakamoto (2010)

> If you were able to delete a bitcoin address and someone sent to it, the money would be lost.

- Source: Re: removing bitcoin addresses
- URL: https://satoshi.nakamotoinstitute.org/posts/bitcointalk/102/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/bitcointalk/102/ on 2026-10-22 (satoshi-post, posts_bitcointalk_102_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 483. Satoshi Nakamoto (2010)

> Maybe it could get an initial value circularly as you've suggested, by people foreseeing its potential usefulness for exchange. (I would definitely want some) Maybe collectors, any random reason could spark it.

- Source: Re: Bitcoin does NOT violate Mises' Regression Theorem
- URL: https://satoshi.nakamotoinstitute.org/posts/bitcointalk/428/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/bitcointalk/428/ on 2026-10-22 (satoshi-post, posts_bitcointalk_428_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 484. Satoshi Nakamoto (2010)

> Proof-of-work has the nice property that it can be relayed through untrusted middlemen.

- Source: Re: Bitcoin minting is thermodynamically perverse
- URL: https://satoshi.nakamotoinstitute.org/posts/bitcointalk/327/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/bitcointalk/327/ on 2026-10-22 (satoshi-post, posts_bitcointalk_327_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 485. Satoshi Nakamoto (2010)

> The cash register displays a QR-code encoding a bitcoin address and amount on a screen and you photo it with your mobile.

- Source: Re: URI-scheme for bitcoin
- URL: https://satoshi.nakamotoinstitute.org/posts/bitcointalk/73/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/bitcointalk/73/ on 2026-10-22 (satoshi-post, posts_bitcointalk_73_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 486. Satoshi Nakamoto (2010)

> The coins are gradually released to the network's nodes based on the CPU power they contribute, so you can get a share of them by contributing your idle CPU time.

- Source: Bitcoin 0.3 released!
- URL: https://satoshi.nakamotoinstitute.org/posts/bitcointalk/168/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/bitcointalk/168/ on 2026-10-22 (satoshi-post, posts_bitcointalk_168_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 487. Satoshi Nakamoto (2010)

> The nature of Bitcoin is such that once version 0.1 was released, the core design was set in stone for the rest of its lifetime.

- Source: Re: Transactions and Scripts: DUP HASH160 ... EQUALVERIFY CHECKSIG
- URL: https://satoshi.nakamotoinstitute.org/posts/bitcointalk/126/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/bitcointalk/126/ on 2026-10-22 (satoshi-post, posts_bitcointalk_126_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 488. Satoshi Nakamoto (2010)

> The problem was, each thing required special support code and data fields whether it was used or not, and only covered one special case at a time.

- Source: Re: Transactions and Scripts: DUP HASH160 ... EQUALVERIFY CHECKSIG
- URL: https://satoshi.nakamotoinstitute.org/posts/bitcointalk/126/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/bitcointalk/126/ on 2026-10-22 (satoshi-post, posts_bitcointalk_126_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 489. Satoshi Nakamoto (2010)

> The utility of the exchanges made possible by Bitcoin will far exceed the cost of electricity used.

- Source: Re: Bitcoin minting is thermodynamically perverse
- URL: https://satoshi.nakamotoinstitute.org/posts/bitcointalk/327/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/bitcointalk/327/ on 2026-10-22 (satoshi-post, posts_bitcointalk_327_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 490. Satoshi Nakamoto (2010)

> When someone tries to buy all the world's supply of a scarce asset, the more they buy the higher the price goes.

- Source: Re: BTC Vulnerability? (Massive Attack against BTC system. Is it really?)
- URL: https://satoshi.nakamotoinstitute.org/posts/bitcointalk/174/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/bitcointalk/174/ on 2026-10-22 (satoshi-post, posts_bitcointalk_174_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 491. Satoshi Nakamoto (2010)

> When you generate a new bitcoin address, it only takes disk space on your own computer (like 500 bytes).

- Source: Re: Could the bitcoin network be destroyed by someone generating endless bitcoin add
- URL: https://satoshi.nakamotoinstitute.org/posts/bitcointalk/98/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/bitcointalk/98/ on 2026-10-22 (satoshi-post, posts_bitcointalk_98_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 492. Satoshi Nakamoto (2010)

> While I don't think Bitcoin is practical for smaller micropayments right now, it will eventually be as storage and bandwidth costs continue to fall.

- Source: Re: Flood attack 0.00000001 BC
- URL: https://satoshi.nakamotoinstitute.org/posts/bitcointalk/318/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/bitcointalk/318/ on 2026-10-22 (satoshi-post, posts_bitcointalk_318_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 493. Satoshi Nakamoto (2010)

> You should put a donation bitcoin address on the page for those who want to add funds to it, which ideally should update to a new address whenever it receives something.

- Source: Re: Get 5 free bitcoins from freebitcoins.appspot.com
- URL: https://satoshi.nakamotoinstitute.org/posts/bitcointalk/129/
- Verified: Fetched https://satoshi.nakamotoinstitute.org/posts/bitcointalk/129/ on 2026-10-22 (satoshi-post, posts_bitcointalk_129_). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 494. Timothy C. May (1988)

> An anonymous computerized market will even make possible abhorrent markets for assassinations and extortion.

- Source: The Crypto Anarchist Manifesto
- URL: https://nakamotoinstitute.org/library/crypto-anarchist-manifesto/
- Verified: Fetched https://nakamotoinstitute.org/library/crypto-anarchist-manifesto/ on 2026-10-22 (library-html, crypto-anarchist-manifesto.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 495. Timothy C. May (1988)

> Computer technology is on the verge of providing the ability for individuals and groups to communicate and interact with each other in a totally anonymous manner.

- Source: The Crypto Anarchist Manifesto
- URL: https://nakamotoinstitute.org/library/crypto-anarchist-manifesto/
- Verified: Fetched https://nakamotoinstitute.org/library/crypto-anarchist-manifesto/ on 2026-10-22 (library-html, crypto-anarchist-manifesto.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 496. Timothy C. May (1988)

> Interactions over networks will be untraceable, via extensive re-routing of encrypted packets and tamper-proof boxes which implement cryptographic protocols with nearly perfect assurance against any tampering.

- Source: The Crypto Anarchist Manifesto
- URL: https://nakamotoinstitute.org/library/crypto-anarchist-manifesto/
- Verified: Fetched https://nakamotoinstitute.org/library/crypto-anarchist-manifesto/ on 2026-10-22 (library-html, crypto-anarchist-manifesto.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 497. Timothy C. May (1988)

> Reputations will be of central importance, far more important in dealings than even the credit ratings of today.

- Source: The Crypto Anarchist Manifesto
- URL: https://nakamotoinstitute.org/library/crypto-anarchist-manifesto/
- Verified: Fetched https://nakamotoinstitute.org/library/crypto-anarchist-manifesto/ on 2026-10-22 (library-html, crypto-anarchist-manifesto.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 498. Timothy C. May (1988)

> The focus has until now been on academic conferences in Europe and the U.S., conferences monitored closely by the National Security Agency.

- Source: The Crypto Anarchist Manifesto
- URL: https://nakamotoinstitute.org/library/crypto-anarchist-manifesto/
- Verified: Fetched https://nakamotoinstitute.org/library/crypto-anarchist-manifesto/ on 2026-10-22 (library-html, crypto-anarchist-manifesto.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 499. Timothy C. May (1988)

> The State will of course try to slow or halt the spread of this technology, citing national security concerns, use of the technology by drug dealers and tax evaders, and fears of societal disintegration.

- Source: The Crypto Anarchist Manifesto
- URL: https://nakamotoinstitute.org/library/crypto-anarchist-manifesto/
- Verified: Fetched https://nakamotoinstitute.org/library/crypto-anarchist-manifesto/ on 2026-10-22 (library-html, crypto-anarchist-manifesto.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 500. Timothy C. May (1988)

> The technology for this revolution—and it surely will be both a social and economic revolution—has existed in theory for the past decade.

- Source: The Crypto Anarchist Manifesto
- URL: https://nakamotoinstitute.org/library/crypto-anarchist-manifesto/
- Verified: Fetched https://nakamotoinstitute.org/library/crypto-anarchist-manifesto/ on 2026-10-22 (library-html, crypto-anarchist-manifesto.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 501. Timothy C. May (1988)

> Two persons may exchange messages, conduct business, and negotiate electronic contracts without ever knowing the True Name, or legal identity, of the other.

- Source: The Crypto Anarchist Manifesto
- URL: https://nakamotoinstitute.org/library/crypto-anarchist-manifesto/
- Verified: Fetched https://nakamotoinstitute.org/library/crypto-anarchist-manifesto/ on 2026-10-22 (library-html, crypto-anarchist-manifesto.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 502. Timothy C. May (1992)

> Alice and Bob, our favorite cryptographic stand-ins, can communicate and transact business without ever meeting or even knowing who the other is.

- Source: Libertaria in Cyberspace
- URL: https://nakamotoinstitute.org/library/libertaria-in-cyberspace/
- Verified: Fetched https://nakamotoinstitute.org/library/libertaria-in-cyberspace/ on 2026-10-22 (library-html, libertaria-in-cyberspace.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 503. Timothy C. May (1992)

> I've spent several years thinking about this, but I've surely missed some good ideas.

- Source: Libertaria in Cyberspace
- URL: https://nakamotoinstitute.org/library/libertaria-in-cyberspace/
- Verified: Fetched https://nakamotoinstitute.org/library/libertaria-in-cyberspace/ on 2026-10-22 (library-html, libertaria-in-cyberspace.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 504. Timothy C. May (1992)

> The basic problem is that physical space is too small, too exposed to the view of others.

- Source: Libertaria in Cyberspace
- URL: https://nakamotoinstitute.org/library/libertaria-in-cyberspace/
- Verified: Fetched https://nakamotoinstitute.org/library/libertaria-in-cyberspace/ on 2026-10-22 (library-html, libertaria-in-cyberspace.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 505. Timothy C. May (1992)

> The cryptographic aspects mean their membership in some community is unknown to others (vis-a-vis the physical or outside world, i.e., their "true names") and physical coercion is reduced.

- Source: Libertaria in Cyberspace
- URL: https://nakamotoinstitute.org/library/libertaria-in-cyberspace/
- Verified: Fetched https://nakamotoinstitute.org/library/libertaria-in-cyberspace/ on 2026-10-22 (library-html, libertaria-in-cyberspace.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 506. Timothy C. May (1992)

> We are not discussing anything that is actually illegal, even under the broad powers of RICO (Racketeer-Influenced and Corrupt Organizations Act, used to go after "conspiracies" of porn dealers and gun dealers, amongst others).

- Source: Libertaria in Cyberspace
- URL: https://nakamotoinstitute.org/library/libertaria-in-cyberspace/
- Verified: Fetched https://nakamotoinstitute.org/library/libertaria-in-cyberspace/ on 2026-10-22 (library-html, libertaria-in-cyberspace.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 507. Timothy C. May (1994)

> A huge demand (life and death), but various laws tightly controlling such markets.

- Source: Crypto Anarchy and Virtual Communities
- URL: https://nakamotoinstitute.org/library/virtual-communities/
- Verified: Fetched https://nakamotoinstitute.org/library/virtual-communities/ on 2026-10-22 (library-html, virtual-communities.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 508. Timothy C. May (1994)

> The basic right of free speech is the right to speak in a language one's neighbors or governing leaders may not find comprehensible: encrypted speech.

- Source: Crypto Anarchy and Virtual Communities
- URL: https://nakamotoinstitute.org/library/virtual-communities/
- Verified: Fetched https://nakamotoinstitute.org/library/virtual-communities/ on 2026-10-22 (library-html, virtual-communities.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 509. Timothy C. May (1994)

> The past two decades have produced a revolution in cryptography (crypto, for short) the science of the making of ciphers and codes.

- Source: Crypto Anarchy and Virtual Communities
- URL: https://nakamotoinstitute.org/library/virtual-communities/
- Verified: Fetched https://nakamotoinstitute.org/library/virtual-communities/ on 2026-10-22 (library-html, virtual-communities.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 510. Timothy C. May (1994)

> Whether through banking regulation or tax laws, it is not likely that digital money will be deployed easily.

- Source: Crypto Anarchy and Virtual Communities
- URL: https://nakamotoinstitute.org/library/virtual-communities/
- Verified: Fetched https://nakamotoinstitute.org/library/virtual-communities/ on 2026-10-22 (library-html, virtual-communities.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 511. Warren Buffett (2018)

> probably rat poison squared

- Source: CNBC: Warren Buffett says bitcoin is 'probably rat poison squared'
- URL: https://www.cnbc.com/2018/05/05/warren-buffett-says-bitcoin-is-probably-rat-poison-squared.html
- Verified: Fetched the CNBC article on 2026-10-22. The article reports: Bitcoin is "probably rat poison squared," he said. Only the words inside the quotation marks are stored as the quote.

### 512. Wei Dai (1998)

> A community is defined by the cooperation of its participants, and efficient cooperation requires a medium of exchange (money) and a way to enforce contracts.

- Source: b-money
- URL: https://nakamotoinstitute.org/library/b-money/
- Verified: Fetched https://nakamotoinstitute.org/library/b-money/ on 2026-10-22 (library-html, b-money.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 513. Wei Dai (1998)

> A valid contract must include a maximum reparation in case of default for each participant party to it.

- Source: b-money
- URL: https://nakamotoinstitute.org/library/b-money/
- Verified: Fetched https://nakamotoinstitute.org/library/b-money/ on 2026-10-22 (library-html, b-money.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 514. Wei Dai (1998)

> Also, each server must periodically publish and commit to its current money creation and money ownership databases.

- Source: b-money
- URL: https://nakamotoinstitute.org/library/b-money/
- Verified: Fetched https://nakamotoinstitute.org/library/b-money/ on 2026-10-22 (library-html, b-money.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 515. Wei Dai (1998)

> Anyone can create money by broadcasting the solution to a previously unsolved computational problem.

- Source: b-money
- URL: https://nakamotoinstitute.org/library/b-money/
- Verified: Fetched https://nakamotoinstitute.org/library/b-money/ on 2026-10-22 (library-html, b-money.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 516. Wei Dai (1998)

> Since the servers must be trusted to a degree, some mechanism is needed to keep them honest.

- Source: b-money
- URL: https://nakamotoinstitute.org/library/b-money/
- Verified: Fetched https://nakamotoinstitute.org/library/b-money/ on 2026-10-22 (library-html, b-money.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

### 517. Wei Dai (1998)

> The protocol proposed in this article allows untraceable pseudonymous entities to cooperate with each other more efficiently, by providing them with a medium of exchange and a method of enforcing contracts.

- Source: b-money
- URL: https://nakamotoinstitute.org/library/b-money/
- Verified: Fetched https://nakamotoinstitute.org/library/b-money/ on 2026-10-22 (library-html, b-money.html). Normalized whitespace, curly quotes, HTML entities, and ligatures. Exact substring match.

## Removed or changed quotes from the old list

### Old 1. Satoshi Nakamoto

> If you don't believe it or don't get it, I don't have the time to try to convince you, sorry.

Changed. The BitcoinTalk post (topic 532) says "believe me" and "I don't have time", not "believe it" and "the time". The corrected sentence is in the new list.

### Old 2. Satoshi Nakamoto

> The root problem with conventional currency is all the trust that's required to make it work.

Kept. The same wording matched a fetched source and is still in the list.

### Old 3. Satoshi Nakamoto

> It might make sense just to get some in case it catches on.

Kept. The same wording matched a fetched source and is still in the list.

### Old 4. Hal Finney

> Running bitcoin.

Changed. The archived tweet is "Running bitcoin" with no period. The period was dropped so the card matches the tweet.

### Old 5. Eric Schmidt

> Bitcoin is a remarkable cryptographic achievement and the ability to create something that is not duplicable in the digital world has enormous value.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 6. Bill Gates

> Bitcoin is a technological tour de force.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 7. Milton Friedman (1999)

> I think the internet is going to be one of the major forces for reducing the role of government. The one thing that's missing, but that will soon be developed, is a reliable e-cash.

Removed. The 1999 interview itself was not fetched (a secondary PDF returned 403), so the old wording was not kept.

### Old 8. Bitcoin Genesis Block

> The Times 03/Jan/2009 Chancellor on brink of second bailout for banks.

Changed. The genesis timestamp in chainparams.cpp has no final period. The period was dropped. The new list has the source string.

### Old 9. Bitcoin Proverb

> Not your keys, not your coins.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 10. Bitcoin Community

> Stay humble, stack sats.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 11. Gigi, 21 Lessons

> In the long run, hard money is superior to soft money.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 12. Saifedean Ammous

> Bitcoin is the first truly digital solution to the problem of money.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 13. Bitcoin Mantra

> Fix the money, fix the world.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 14. Andreas Antonopoulos

> The supply of Bitcoin is limited. Period. No central bank is going to come along and print more.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 15. Bitcoin Culture

> Everyone is a scammer until proven otherwise. Don't trust, verify.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 16. Michael Saylor

> Bitcoin makes money great again. It lets you transact freely, save freely, and live freely.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 17. Michael Saylor

> There is no second best.

Removed. On the fetched Lex Fridman transcript the host says Saylor had said this earlier. Saylor does not say those words on that page, so the line was not kept.

### Old 18. Jack Dorsey

> I don't think there's anything more important in my lifetime to work on.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 19. Roger Ver (before he fell off)

> Bitcoin is the most important invention in the history of the world since the internet.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 20. Hal Finney

> The computer can be used as a tool to liberate and protect people, rather than to control them.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 21. Gigi, 21 Lessons

> One of the greatest things that Satoshi did was disappear.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 22. Bitcoin Education Archive

> Bitcoin has no CEO, no marketing department, no headquarters. It has math.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 23. Bitcoin Community

> We are all Satoshi.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 24. Eric Hughes

> Cypherpunks write code.

Kept. The same wording matched a fetched source and is still in the list.

### Old 25. Eric Hughes, A Cypherpunk's Manifesto

> Privacy is necessary for an open society in the electronic age.

Kept. The same wording matched a fetched source and is still in the list.

### Old 26. Robert Breedlove

> Money is a tool for trading human time.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 27. Gigi

> Bitcoin is Time.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 28. Saifedean Ammous

> The root cause of the housing crisis, student debt crisis, and healthcare crisis is the money crisis.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 29. Bitcoin Community

> Tick tock, next block.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 30. Bitcoin Educators

> The difficulty adjustment is the most elegant feature of Bitcoin.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 31. Leon Luow

> Every informed person needs to know about Bitcoin because it might be one of the world's most important developments.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 32. Parker Lewis

> Bitcoin is the only commodity in the world that the more demand there is, the more supply does NOT increase.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 33. Parker Lewis / Ernest Hemingway

> Gradually, then suddenly.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 34. Victor Hugo (on Bitcoin)

> You can't stop an idea whose time has come.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 35. Lyn Alden

> Bitcoin is a hedge against the entire system.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 36. Bitcoiners

> The question isn't what Bitcoin's price will be. The question is what the dollar's price will be.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 37. Anonymous Bitcoiner

> I was once told that nobody ever lost money saving in Bitcoin for 4+ years. I checked. It's true.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 38. Bitcoin Maximalists

> Bitcoin is the exit.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 39. Bitcoin Ethos

> Don't trust, verify.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 40. Bitcoin Twitter

> Number go up technology.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 41. Bitcoin Mining Community

> Energy is the universal currency. Bitcoin makes that literal.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 42. Bitcoin Educators

> Bitcoin is not an investment — it is a savings technology.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 43. Voltaire

> Fiat currency always returns to its intrinsic value — zero.

Removed. This wording is a famous misattribution. No fetched primary text contains it.

### Old 44. Mayer Amschel Rothschild

> Give me control of a nation's money supply, and I care not who makes its laws.

Removed. This wording is a famous misattribution. No fetched primary text contains it.

### Old 45. Milton Friedman

> Inflation is taxation without legislation.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 46. Bitcoin Community

> Bitcoin is for enemies. That's the whole point.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 47. Many Bitcoiners

> When you understand Bitcoin, you understand everything else differently.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 48. Bitcoin Proverb

> Bitcoin doesn't care about your feelings.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 49. Matt Odell

> Stack sats and stay humble.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 50. Bitcoin Memes

> Number go up because money printer go brr.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 51. Benjamin Franklin

> Those who would give up essential liberty, to purchase a little temporary safety, deserve neither liberty nor safety.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 52. Ronald Reagan

> Freedom is never more than one generation away from extinction.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 53. Albert Camus

> The only way to deal with an unfree world is to become so absolutely free that your very existence is an act of rebellion.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 54. Thomas Jefferson

> If the American people ever allow private banks to control the issue of their currency, first by inflation, then by deflation, the banks and corporations that will grow up around them will deprive the people of all property.

Removed. This wording is a famous misattribution. No fetched primary text contains it.

### Old 55. Henry Ford

> It is well enough that people of the nation do not understand our banking and monetary system, for if they did, I believe there would be a revolution before tomorrow morning.

Removed. This wording is a famous misattribution. No fetched primary text contains it.

### Old 56. H.L. Mencken

> The most dangerous man to any government is the man who is able to think things out for himself.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 57. George Orwell

> In a time of deceit, telling the truth is a revolutionary act.

Removed. This wording is a famous misattribution. No fetched primary text contains it.

### Old 58. H.L. Mencken

> The urge to save humanity is almost always a false front for the urge to rule it.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 59. Milton Friedman

> A society that puts equality before freedom will get neither. A society that puts freedom before equality will get a high degree of both.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 60. Frédéric Bastiat

> The state is that great fiction by which everyone tries to live at the expense of everyone else.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 61. Ludwig von Mises

> There is no means of avoiding the final collapse of a boom brought about by credit expansion.

Removed. In the fetched Human Action scan that sentence is garbled ("finaI colfapse") and was not corrected into a quote. A clean following sentence from the same page is in the new list.

### Old 62. Ernest Hemingway

> The first panacea for a mismanaged nation is inflation of the currency; the second is war. Both bring a temporary prosperity; both bring a permanent ruin.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 63. J.P. Morgan

> Gold is money. Everything else is credit.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 64. Ronald Reagan

> We don't have a trillion-dollar debt because we haven't taxed enough; we have a trillion-dollar debt because we spend too much.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 65. Ludwig von Mises

> Government is the only institution that can take a valuable commodity like paper, and make it worthless by applying ink.

Removed. The phrase "paper and ink" does not occur in the fetched Human Action text.

### Old 66. Ayn Rand

> Whenever destroyers appear among men, they start by destroying money.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 67. Vladimir Lenin

> The way to crush the bourgeoisie is to grind them between the millstones of taxation and inflation.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 68. Saifedean Ammous

> Savings represent goods produced but not yet consumed. That's what real wealth is — not digits in a bank database.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 69. H.G. Wells

> Civilization is in a race between education and catastrophe. Let us learn the truth and spread it as far and wide as our circumstances allow.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 70. Voltaire

> Paper money eventually returns to its intrinsic value — zero.

Removed. This wording is a famous misattribution. No fetched primary text contains it.

### Old 71. Bitcoin Community

> Bitcoin is the separation of money and state.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 72. Jeff Booth

> Bitcoin is the first money in the history of the world where the supply is entirely unaffected by an increase in demand.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 73. Bitcoin Educators

> In a world where everything is printed, scarcity is the ultimate feature.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 74. Jack Mallers

> Bitcoin is hope for humanity.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 75. Bitcoin Community

> The cost of Bitcoin is measured in electricity. The cost of fiat is measured in human freedom.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 76. Bitcoin Educators

> Your savings should not be someone else's liability.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 77. Alex Gladstein

> Bitcoin is the peaceful protest that cannot be silenced.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 78. Many Bitcoiners

> Bitcoin gives us the ability to opt out of a system that was designed to extract value from us.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 79. Bitcoin Mining Community

> Proof of work means proof of energy. Energy is the one thing that cannot be faked.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 80. Bitcoin Stats

> The Bitcoin network processes more value per year than Visa. Without a CEO.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 81. Bitcoin Community

> If Bitcoin is a bubble, it's the only bubble that reflated itself five times in a row.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 82. Bitcoin Obituaries

> Bitcoin has died 474 times according to the media. It's still here.

Changed. Fetched https://99bitcoins.com/bitcoin-obituaries/ on 2026-10-22 and the heading said 477, so a fixed count goes stale. Replaced with that page's number-free sentence.

### Old 83. Bitcoin Twitter

> Your grandchildren will ask you why you didn't buy Bitcoin when it was under six figures.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 84. Every Bitcoiner, Every Year

> The next 4 years are going to be very exciting for Bitcoin.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 85. Bitcoin Community

> Bitcoin isn't getting more expensive. Your dollars are getting cheaper.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 86. Bitcoin Wisdom

> If you can't hold it, you don't own it. If you didn't earn it, you'll lose it.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 87. Bitcoin Community

> Think in sats, not dollars.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 88. Bitcoin Proverb

> The best time to buy Bitcoin was 10 years ago. The second best time is now.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 89. Jason Lowery

> Work is the transfer of energy over time. Money should measure exactly that.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 90. Bitcoin Educators

> Bitcoin is not anti-government. Bitcoin is anti-fraud.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 91. Eric Hughes, A Cypherpunk's Manifesto

> We must defend our own privacy if we expect to have any.

Kept. The same wording matched a fetched source and is still in the list.

### Old 92. Julian Assange

> Cryptography is the ultimate form of non-violent direct action.

Removed. Those words are not in the 2006 essay that was fetched (State and Terrorist Conspiracies).

### Old 93. Jacob Appelbaum

> Strong cryptography can resist an unlimited application of violence.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 94. John Gilmore

> The Net interprets censorship as damage and routes around it.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 95. Jason Lowery, Softwar

> Bitcoin is a weapon of peace.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 96. Bitcoin Node Runners

> Running a node means nobody can change the rules on you.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 97. Bitcoin Mining Community

> Hashrate is the heartbeat of Bitcoin. As long as miners mine, Bitcoin lives.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 98. Lightning Network Community

> Lightning is what makes Bitcoin usable for 8 billion people.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 99. The Bitcoin Protocol

> 2,099,999,997,690,000 satoshis. That's all there will ever be.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 100. Cypherpunks

> Code is speech. Math is law. Cryptography is defense.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 101. Robert Metcalfe (1995) — They said this about Bitcoin too

> I predict the Internet will go spectacularly supernova and in 1996 catastrophically collapse.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 102. Thomas Jefferson

> Every generation needs a new revolution.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 103. Often attributed to Gandhi

> First they ignore you, then they laugh at you, then they fight you, then you win.

Removed. This wording is a famous misattribution. No fetched primary text contains it.

### Old 104. John D. Rockefeller

> I do not think there is any other quality so essential to success of any kind as the quality of perseverance.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 105. Albert Einstein

> The world is a dangerous place, not because of those who do evil, but because of those who look on and do nothing.

Removed. This wording is a famous misattribution. No fetched primary text contains it.

### Old 106. G. Michael Hopf

> Hard times create strong men. Strong men create good times. Good times create weak men. Weak men create hard times.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.

### Old 107. Benjamin Franklin

> An investment in knowledge pays the best interest.

Removed. No fetched source contained this wording, or the familiar line is a slogan, a paraphrase, or a misattribution. It was not kept.
