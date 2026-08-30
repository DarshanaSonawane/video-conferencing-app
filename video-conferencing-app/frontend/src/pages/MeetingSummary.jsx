import React, { useCallback, useContext, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import HomeIcon from '@mui/icons-material/Home';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import ScheduleIcon from '@mui/icons-material/Schedule';

export default function MeetingSummary() {

    const { url } = useParams();
    const meetingCode = decodeURIComponent(url || "");

    const { summarizeMeeting } = useContext(AuthContext);
    const routeTo = useNavigate();

    const [status, setStatus] = useState("loading"); // loading | done | error
    const [summary, setSummary] = useState(null);
    const [errorMsg, setErrorMsg] = useState("");

    const loadSummary = useCallback(async () => {
        setStatus("loading");
        setErrorMsg("");
        try {
            const result = await summarizeMeeting(meetingCode);
            setSummary(result?.summary || null);
            setStatus("done");
        } catch (err) {
            setErrorMsg(err?.response?.data?.message || err.message || "Could not generate the meeting summary");
            setStatus("error");
        }
    }, [meetingCode, summarizeMeeting]);

    useEffect(() => {
        loadSummary();
    }, [loadSummary])

    if (status === "loading") {
        return (
            <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
                <CircularProgress size={56} />
                <Typography variant="h6">Generating your meeting summary...</Typography>
                <Typography color="text.secondary" sx={{ maxWidth: 420, textAlign: "center" }}>
                    Our AI is reviewing the full transcript to pull out decisions, action items and chapters. This usually takes a few seconds.
                </Typography>
            </Box>
        );
    }

    if (status === "error") {
        return (
            <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, padding: 3 }}>
                <Alert severity="error" sx={{ width: "100%", maxWidth: 560 }}>{errorMsg}</Alert>
                <Box sx={{ display: "flex", gap: 2 }}>
                    <Button variant="contained" startIcon={<RefreshIcon />} onClick={loadSummary}>Try again</Button>
                    <Button variant="outlined" startIcon={<HomeIcon />} onClick={() => routeTo("/home")}>Back to home</Button>
                </Box>
            </Box>
        );
    }

    const hasHighlights = summary?.highlights?.length > 0;
    const hasDecisions = summary?.decisions?.length > 0;
    const hasActionItems = summary?.actionItems?.length > 0;
    const hasChapters = summary?.chapters?.length > 0;

    return (
        <div style={{ minHeight: "100vh", padding: "32px clamp(16px, 6vw, 80px)" }}>

            <Box sx={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 3, flexWrap: "wrap" }}>
                <IconButton onClick={() => routeTo("/home")}>
                    <HomeIcon />
                </IconButton>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>Meeting Summary</Typography>
                <Chip label={`Code: ${meetingCode}`} variant="outlined" />
            </Box>

            <Card variant="outlined" sx={{ marginBottom: 3 }}>
                <CardContent>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, letterSpacing: ".08em" }} color="text.secondary" gutterBottom>
                        OVERVIEW
                    </Typography>
                    <Typography variant="body1" sx={{ lineHeight: 1.7 }}>
                        {summary?.overall || "No summary was generated for this meeting."}
                    </Typography>
                </CardContent>
            </Card>

            <Card variant="outlined" sx={{ marginBottom: 3 }}>
                <CardContent>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, letterSpacing: ".08em" }} color="text.secondary" gutterBottom>
                        KEY HIGHLIGHTS
                    </Typography>
                    {hasHighlights ? (
                        <List dense disablePadding>
                            {summary.highlights.map((highlight, index) => (
                                <ListItem key={index} disableGutters>
                                    <CheckCircleOutlineIcon sx={{ marginRight: 1.5, color: "warning.main", fontSize: 20 }} />
                                    <ListItemText primary={highlight} />
                                </ListItem>
                            ))}
                        </List>
                    ) : (
                        <Typography color="text.secondary">No notable announcements were made in this meeting.</Typography>
                    )}
                </CardContent>
            </Card>

            <Card variant="outlined" sx={{ marginBottom: 3 }}>
                <CardContent>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, letterSpacing: ".08em" }} color="text.secondary" gutterBottom>
                        KEY DECISIONS
                    </Typography>
                    {hasDecisions ? (
                        <List dense disablePadding>
                            {summary.decisions.map((decision, index) => (
                                <ListItem key={index} disableGutters>
                                    <CheckCircleOutlineIcon sx={{ marginRight: 1.5, color: "success.main", fontSize: 20 }} />
                                    <ListItemText primary={decision} />
                                </ListItem>
                            ))}
                        </List>
                    ) : (
                        <Typography color="text.secondary">No key decisions were captured in this meeting.</Typography>
                    )}
                </CardContent>
            </Card>

            <Card variant="outlined" sx={{ marginBottom: 3 }}>
                <CardContent>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, letterSpacing: ".08em" }} color="text.secondary" gutterBottom>
                        ACTION ITEMS
                    </Typography>
                    {hasActionItems ? (
                        <List dense disablePadding>
                            {summary.actionItems.map((item, index) => (
                                <ListItem key={index} disableGutters
                                    secondaryAction={
                                        item.owner ? <Chip size="small" label={`Owner: ${item.owner}`} color="primary" variant="outlined" /> : null
                                    }>
                                    <TaskAltIcon sx={{ marginRight: 1.5, color: "primary.main", fontSize: 20 }} />
                                    <ListItemText primary={item.task} />
                                </ListItem>
                            ))}
                        </List>
                    ) : (
                        <Typography color="text.secondary">No action items came out of this meeting.</Typography>
                    )}
                </CardContent>
            </Card>

            <Card variant="outlined">
                <CardContent>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, letterSpacing: ".08em" }} color="text.secondary" gutterBottom>
                        CHAPTERS
                    </Typography>
                    {hasChapters ? (
                        summary.chapters.map((chapter, index) => (
                            <React.Fragment key={index}>
                                {index > 0 && <Divider sx={{ marginY: 1.5 }} />}
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                                    <ScheduleIcon sx={{ color: "text.secondary", fontSize: 20 }} />
                                    <Typography sx={{ fontWeight: 600 }}>{chapter.title}</Typography>
                                    {(chapter.startTime || chapter.endTime) && (
                                        <Chip size="small" label={`${chapter.startTime || "--:--:--"} → ${chapter.endTime || "--:--:--"}`} variant="outlined" />
                                    )}
                                </Box>
                            </React.Fragment>
                        ))
                    ) : (
                        <Typography color="text.secondary">No topic chapters were detected in this meeting.</Typography>
                    )}
                </CardContent>
            </Card>

        </div>
    )
}