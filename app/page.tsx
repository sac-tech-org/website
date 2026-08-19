import type { Metadata } from "next";
import Link from "next/link";
import { BridgeArt } from "../components/bridge-art";
import { JoinCommunity } from "../components/join-community";
import style from "./home.module.css";

export const metadata: Metadata = {
	description:
		"Meet people, share what you know, and find technology events around Sacramento.",
};

export default function Home() {
	return (
		<main className={style.page} id="main-content">
			<section className={style.hero}>
				<div className={style.heroInner}>
					<div className={style.heroCopy}>
						<p className={style.eyebrow}>
							A technology community for Sacramento
						</p>
						<h1>Find your people in Sacramento tech.</h1>
						<p className={style.heroText}>
							SacTech is a welcoming place for people who design, build, teach,
							or work with technology across the Sacramento region.
						</p>
						<div className={style.heroActions}>
							<Link className={style.primaryAction} href="/events">
								Explore events <span aria-hidden="true">→</span>
							</Link>
							<Link className={style.secondaryAction} href="#join">
								Join the community
							</Link>
						</div>
					</div>
					<BridgeArt className={style.heroArt} />
				</div>
			</section>

			<section className={style.mission} id="community">
				<div className={style.sectionInner}>
					<div className={style.sectionIntro}>
						<p className={style.eyebrowDark}>Why SacTech exists</p>
						<h2>Learn from each other and build close to home.</h2>
						<p>
							SacTech brings technologists, designers, students, career
							changers, and other community members together to share skills and
							make local connections.
						</p>
					</div>

					<div className={style.values}>
						<article>
							<span aria-hidden="true" className={style.valueMark}>
								01
							</span>
							<h3>Inclusive</h3>
							<p>
								You belong here, whatever your background, identity, field, or
								experience level.
							</p>
						</article>
						<article>
							<span aria-hidden="true" className={style.valueMark}>
								02
							</span>
							<h3>Practical</h3>
							<p>
								We swap practical skills and make room for generous
								conversations and useful local connections.
							</p>
						</article>
						<article>
							<span aria-hidden="true" className={style.valueMark}>
								03
							</span>
							<h3>Civic-minded</h3>
							<p>
								We use technology to help our neighbors and the Sacramento
								region.
							</p>
						</article>
					</div>
				</div>
			</section>

			<section className={style.eventsPreview}>
				<div className={style.sectionInner}>
					<div className={style.eventsPanel}>
						<p className={style.eyebrowDark}>Upcoming events</p>
						<h2>We&apos;re rebuilding the calendar around local events.</h2>
						<p>
							The imported sample schedule is gone. We&apos;ll add SacTech and
							community events as soon as we&apos;ve verified the details.
						</p>
						<Link className={style.textAction} href="/events">
							Visit the events page <span aria-hidden="true">→</span>
						</Link>
					</div>
					<div className={style.communityPanel}>
						<p className={style.eyebrow}>How we gather</p>
						<h2>Find a way to join in.</h2>
						<ul>
							<li>Community conversations</li>
							<li>Peer-led learning</li>
							<li>Local and online gatherings</li>
						</ul>
						<Link href="/code-of-conduct">Read our Code of Conduct</Link>
					</div>
				</div>
			</section>

			<section className={style.join} id="join">
				<div className={style.joinInner}>
					<div>
						<p className={style.eyebrow}>Join the community</p>
						<h2>Meet the community on Slack.</h2>
						<p>
							Join the SacTech Slack to share what you know and meet more people
							in the local community.
						</p>
					</div>
					<JoinCommunity inviteLink={process.env.NEXT_PUBLIC_INVITE_LINK} />
				</div>
			</section>
		</main>
	);
}
