"""
The Auditor - Python Wrapper
Fact-checks Professor's reviews for accuracy
"""

from datetime import datetime
import hashlib
import random

class TheAuditor:
    
    @staticmethod
    def audit_review(review: dict) -> dict:
        """
        Fact-check a Professor review
        
        Args:
            review: TradeReview dict from TheProfessor
        
        Returns:
            AuditReport dict with verdict and evidence
        """
        is_news_critique = 'news' in review['critique'].lower() or 'volatility' in review['critique'].lower()
        
        verdict = 'CONFIRMED'
        evidence = 'Cross-referenced timestamp with global economic calendar. No conflicting data found.'
        final_grade = review['grade']
        
        # Logic Reversal (Simulated "Fact Check")
        if is_news_critique:
            # 30% chance to dispute the professor
            if random.random() > 0.7:
                verdict = 'OVERTURNED'
                evidence = 'SEARCH RESULT: Zero high-impact red folder events found during trade duration. Market noise was standard deviation.'
                
                # Improve grade if overturned
                if review['grade'] == 'F':
                    final_grade = 'C'
                elif review['grade'] == 'C':
                    final_grade = 'B'
            else:
                evidence = 'CONFIRMED: FOMC Minutes were released 5 minutes prior to entry. Hazardous conditions verified.'
        
        elif review['grade'] == 'F':
            # Auditor checks for "Technical Glitches" on F grades
            if random.random() > 0.9:
                verdict = 'OVERTURNED'
                evidence = 'LOG ANALYSIS: Exchange reported 500ms latency spike. Bad entry was lag-induced, not manual error.'
                final_grade = 'C+'
        
        # Generate unique ID
        audit_id = hashlib.md5(f"{review['id']}{datetime.now().isoformat()}".encode()).hexdigest()[:8]
        
        audit = {
            'id': audit_id,
            'review_id': review['id'],
            'timestamp': datetime.now().isoformat(),
            'verdict': verdict,
            'evidence': evidence,
            'final_grade': final_grade
        }
        
        return audit
